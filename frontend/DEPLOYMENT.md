# Deploying StellarYield for the frontend demo

End-to-end walkthrough: build the contracts, deploy them to testnet, create a
vault the frontend can talk to, and run the full lifecycle in the UI.

Everything below assumes you are at the repository root.

## The short version

Steps 1–7 are scripted. After installing the prerequisites in step 0:

```bash
./scripts/deploy-demo.sh
```

It builds the contracts, funds a deployer, issues a demo USDC, deploys the
factory, creates a vault, opens the KYC gate, grants the operator role, and
writes `frontend/.env`. Then jump to [step 8](#8-run-the-demo).

The manual steps below are the fallback if any single stage needs adjusting —
and they explain what each call actually does.

---

## 0. Prerequisites

```bash
# Rust + the Soroban wasm target
rustup target add wasm32v1-none

# Stellar CLI
cargo install --locked stellar-cli

# Freighter browser extension, switched to Testnet
# https://www.freighter.app/
```

Check the toolchain:

```bash
stellar --version
```

---

## 1. Build the contracts

```bash
cd soroban-contracts && make build && cd ..
ls -lh target/wasm32v1-none/release/{single_rwa_vault,vault_factory}.wasm
```

---

## 2. Create and fund a deployer identity

The deployer becomes the factory admin, the vault admin, and the operator — one
key drives the whole demo.

```bash
stellar keys generate --global deployer --network testnet --fund
stellar keys address deployer          # → G... (call this $ADMIN)
```

Import this same key into Freighter (`stellar keys show deployer` prints the
secret) so the browser signs as the operator and sees the operator panel.

---

## 3. Deploy a test USDC token

The vault needs a SEP-41 token to accept as its underlying asset. On testnet the
simplest option is a Stellar Asset Contract for an asset you issue yourself.

```bash
# An issuer for the demo asset
stellar keys generate --global usdc-issuer --network testnet --fund
ISSUER=$(stellar keys address usdc-issuer)

# Wrap USDC:$ISSUER as a Soroban token contract
stellar contract asset deploy \
  --asset "USDC:$ISSUER" \
  --source-account deployer \
  --network testnet
# → C... (call this $ASSET)
```

Give the deployer a balance to deposit and to pay yield with:

```bash
ASSET=<the C... address printed above>
ADMIN=$(stellar keys address deployer)

stellar contract invoke --id "$ASSET" --source-account usdc-issuer --network testnet \
  -- mint --to "$ADMIN" --amount 10000000000     # 10,000 USDC at 7 decimals
```

> **Note on decimals.** A Stellar Asset Contract reports 7 decimals, while
> vault shares are minted at 6 (`share_decimals: 6` in the factory). The
> frontend reads both values from chain and formats each side correctly, so the
> mismatch is only something to keep in mind when typing amounts.

Confirm the balance:

```bash
stellar contract invoke --id "$ASSET" --source-account deployer --network testnet \
  -- balance --id "$ADMIN"
```

---

## 4. Deploy the factory

`scripts/deploy-testnet.sh` uploads the vault WASM, deploys the factory, and
writes `soroban-contracts/.env.testnet`.

```bash
SOURCE_ACCOUNT=deployer \
ADMIN_ADDRESS=$ADMIN \
DEFAULT_ASSET=$ASSET \
ZKME_VERIFIER=$ADMIN \
COOPERATOR=$ADMIN \
./scripts/deploy-testnet.sh --non-interactive
```

`ZKME_VERIFIER` is a placeholder here — step 6 disables the KYC check on the
vault itself. Record the printed `FACTORY_ADDRESS`.

---

## 5. Create a vault

> ⚠️ `scripts/create-vault.sh` passes arguments (`funding_target`,
> `exit_fee_bps`, `epoch_duration_seconds`) that the current
> `create_single_rwa_vault` entry point does not accept. Use the call below
> instead — it targets `create_single_rwa_vault_full`, which takes the full
> `CreateVaultParams` struct and lets you set a funding target and minimum
> deposit.

```bash
source soroban-contracts/.env.testnet

MATURITY=$(( $(date +%s) + 7776000 ))   # 90 days out
DEADLINE=$(( $(date +%s) + 604800 ))    # funding closes in 7 days

stellar contract invoke \
  --id "$FACTORY_ADDRESS" \
  --source-account deployer \
  --network testnet \
  -- create_single_rwa_vault_full \
  --caller "$ADMIN" \
  --params "{
    \"asset\": \"$ASSET\",
    \"name\": \"US Treasury 6-Month Bill\",
    \"symbol\": \"syUSTB\",
    \"rwa_name\": \"US Treasury 6-Month Bill\",
    \"rwa_symbol\": \"USTB6M\",
    \"rwa_document_uri\": \"ipfs://bafybeibexampledocumenthash\",
    \"rwa_category\": \"Government Debt\",
    \"expected_apy\": 512,
    \"maturity_date\": $MATURITY,
    \"funding_deadline\": $DEADLINE,
    \"funding_target\": \"1000000000\",
    \"min_deposit\": \"10000000\",
    \"max_deposit_per_user\": \"0\",
    \"early_redemption_fee_bps\": 200
  }"
# → C... (call this $VAULT)
```

Amounts are in the asset's smallest unit (7 decimals here): the target is
100 USDC and the minimum deposit is 1 USDC. `expected_apy` is in basis points,
so 512 renders as 5.12%.

---

## 6. Open up KYC and grant the operator role

The vault treats *its own address* as the "no verifier" sentinel — pointing
`zkme_verifier` at the vault makes `is_kyc_verified` return true for everyone,
which is what you want for a demo.

```bash
VAULT=<the C... address from step 5>

stellar contract invoke --id "$VAULT" --source-account deployer --network testnet \
  -- set_zkme_verifier --caller "$ADMIN" --verifier "$VAULT"

stellar contract invoke --id "$VAULT" --source-account deployer --network testnet \
  -- set_operator --caller "$ADMIN" --operator "$ADMIN" --status true
```

Verify:

```bash
stellar contract invoke --id "$VAULT" --source-account deployer --network testnet \
  -- is_kyc_verified --user "$ADMIN"     # → true
stellar contract invoke --id "$VAULT" --source-account deployer --network testnet \
  -- vault_state                          # → "Funding"
```

---

## 7. Point the frontend at the deployment

```bash
cd frontend
cp .env.example .env
```

Fill in `.env`:

```env
VITE_STELLAR_NETWORK=testnet
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_FACTORY_ADDRESS=<FACTORY_ADDRESS from step 4>
```

Then:

```bash
npm install
npm run dev      # http://localhost:5173
```

The frontend consumes the repo's own SDK from `../sdk`. If you edit anything
under `sdk/src`, rebuild it with `npm run build` in `sdk/` and restart Vite.

---

## 8. Run the demo

Open the app, click **launch app**, connect Freighter, and pick the vault.
Because the connected account is the operator, both the investor actions and the
**Operator controls** panel are visible — the full lifecycle runs from one screen.

| # | Action | Where | What it proves |
|---|--------|-------|----------------|
| 1 | Deposit 100 USDC | Actions → Deposit | `deposit` mints shares 1:1, funding progress hits 100% |
| 2 | Activate vault | Operator controls | `activate_vault` moves Funding → Active |
| 3 | Distribute 5 USDC | Operator controls | `distribute_yield` opens epoch 1, pulls yield into the vault |
| 4 | Claim yield | Actions → Claim yield | `claim_yield` pays out the pro-rata accrual; share price rises above 1.0 |
| 5 | Bring maturity forward | Operator controls | `set_maturity_date` — demo shortcut so maturity is reachable |
| 6 | Mature vault | Operator controls | `mature_vault` moves Active → Matured |
| 7 | Redeem all shares | Actions → Redeem | `redeem_at_maturity` burns shares, returns principal + yield |
| 8 | Close vault | Operator controls | `close_vault` moves Matured → Closed once supply is zero |

To show the investor side without operator powers, connect a second Freighter
account: it sees only the deposit / claim / redeem actions.

### Other flows worth showing

- **Early redemption.** While Active, redeem from a non-operator account —
  shares are escrowed into a request and a 2% exit fee applies. The operator
  settles it with `process_early_redemption`.
- **Failed funding.** Create a vault with a deadline a minute out, let it lapse,
  then call `cancel_funding`. Depositors refund from the app's Redeem tab.

---

## Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| "No deployment configured" | `VITE_FACTORY_ADDRESS` is unset. Vite only reads `.env` at startup — restart the dev server. |
| Vault list is empty | The factory has no registered vaults. Re-run step 5, or pin the vault directly with `VITE_EXTRA_VAULTS=<vault id>`. |
| "has not passed KYC" | Step 6 was skipped, or `zkme_verifier` points at a contract that is not a real verifier. |
| "Account not found on this network" | The Freighter account is unfunded. Fund it: `stellar keys fund <name> --network testnet`. |
| Deposit fails with a trustline error | The account holds no balance of the asset. Mint some (step 3). |
| "Caller is not an operator" | The connected Freighter account is not the operator. Run `set_operator` for it, or switch accounts. |
| Simulation errors after a contract change | The factory still holds the old WASM hash. Re-upload and call `set_vault_wasm_hash`. |
