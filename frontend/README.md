# StellarYield frontend

A demo MVP for the StellarYield Soroban contracts: a descriptive landing page
plus an app that runs a vault through its whole lifecycle against live contracts.

```bash
npm install
cp .env.example .env     # set VITE_FACTORY_ADDRESS
npm run dev              # http://localhost:5173
```

No deployment yet? Follow [DEPLOYMENT.md](./DEPLOYMENT.md) — it covers building
the contracts, deploying the factory, creating a vault, and the click-by-click
demo script.

## What it does

| Screen | Purpose |
|--------|---------|
| **Landing** | Explains the protocol — roles, the four-step flow, the vault state machine, what the contracts enforce — and launches the app. |
| **Vault list** | Every SingleRWA vault registered in the factory, with state, total assets, expected APY, and funding progress. |
| **Vault detail** | Vault and user state, the investor actions valid for the current state, and (for operators) the lifecycle controls. |

## Contract calls

Reads go through simulation — no wallet, no fees:

- **Factory** — `get_single_rwa_vaults`
- **Vault** — `get_vault_overview`, `get_user_overview`, `get_config_snapshot`,
  `get_rwa_details`, `name`, `symbol`, `decimals`, `share_price`,
  `funding_target`, `funding_progress_bps`, `time_to_maturity`,
  `total_yield_distributed`, `is_operator`, `max_deposit`
- **Asset token** — `decimals`, `symbol`, `balance`

Writes are preflighted, signed in Freighter, submitted, then polled to confirmation:

- **Investor** — `deposit`, `claim_yield`, `redeem_at_maturity`,
  `request_early_redemption`, `refund`
- **Operator** — `activate_vault`, `distribute_yield`, `set_maturity_date`,
  `mature_vault`, `close_vault`

Which actions appear follows the vault's state (`Funding` → `Active` →
`Matured` → `Closed`, or `Cancelled`), so the UI never offers a call the
contract would reject.

## Architecture

```
src/
  config.ts              network, RPC, factory address (from VITE_* env)
  lib/
    soroban.ts           readContract (simulate) + writeContract (sign & send)
    errors.ts            contract error codes → readable messages
    format.ts            amount / date / bps formatting and parsing
    scval.ts             normalises decoded Soroban enums
  hooks/
    useWallet.ts         Freighter connection
    useVaults.ts         factory registry → vault list
    useVaultData.ts      one vault + connected user
    useTransaction.ts    write lifecycle and stage reporting
  components/            Landing, Header, VaultList, VaultDetail,
                         ActionPanel, OperatorPanel, TxStatus, ui
```

Contract encoding and the Freighter signing wrapper come from the repo's own
SDK (`@stellaryield/sdk`, linked from `../sdk`) rather than being reimplemented.
After editing `sdk/src`, run `npm run build` in `sdk/` and restart Vite.

State lives in hooks and is passed down as props — no store, no router. The two
screens are switched by a `route` union in `App.tsx`.

## Design

Warm cream ground with a faint grid, near-black type, an italic serif accent for
headline counterpoints, pill buttons, and hairline-bordered white cards. All
colors are CSS custom properties in `styles.css`; the dark theme redefines the
same tokens under `[data-theme="dark"]`, and the toggle sits bottom-left.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Types only |
