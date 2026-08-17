# StellarYield

Vault infrastructure for tokenized real-world assets on Stellar, built with Soroban.

A factory deploys one isolated vault per real-world asset — a treasury bill, an invoice
pool, a private credit facility. Depositors put in a stablecoin and receive share tokens;
the operator distributes yield on-chain, epoch by epoch; holders claim their pro-rata
share and redeem at maturity for principal plus yield, in the asset they started with.

The funding round, the yield accounting, and the redemption path are all enforced by the
contract rather than by an off-chain promise.

---

## How a vault works

Every vault moves through an explicit on-chain state machine. What a user can do depends
entirely on where the vault sits:

| State | What it means | What's possible |
|---|---|---|
| `Funding` | Raising toward the funding target | Deposit; refund if the round is later cancelled |
| `Active` | Target met, capital deployed into the asset | Operator distributes yield; holders claim or request early redemption |
| `Matured` | The asset has paid out | Redeem shares for principal plus unclaimed yield |
| `Closed` | Every share redeemed | Terminal |
| `Cancelled` | Funding failed before the deadline | Depositors refund themselves |

Shares follow ERC-4626-style accounting (`deposit` / `mint` / `withdraw` / `redeem` plus
`preview_*` views) and are themselves SEP-41 tokens, so they transfer and compose like any
other Soroban asset.

**Yield is distributed into numbered epochs.** Each distribution snapshots total shares at
that moment, so a depositor arriving afterwards cannot claim earlier yield, and existing
holders cannot be diluted retroactively.

**KYC is pluggable.** Deposits check an external zkMe verifier contract. Pointing a vault's
verifier at its own address disables the gate — useful for testnets and permissionless
deployments.

## Repository layout

| Path | What it is |
|---|---|
| [`soroban-contracts/`](soroban-contracts/) | Rust contracts — `single_rwa_vault` and `vault_factory` |
| [`sdk/`](sdk/) | TypeScript SDK: typed contract clients, ScVal encoding, Freighter signing |
| [`backend/`](backend/) | Express API that indexes on-chain events into PostgreSQL and serves REST |
| [`frontend/`](frontend/) | React app demonstrating the full vault lifecycle against live contracts |
| [`scripts/`](scripts/) | Deployment and vault-creation helpers |

The Cargo workspace root is the repository root, so compiled WASM lands in
`target/wasm32v1-none/release/`.

## Quickstart

### Prerequisites

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Build and test the contracts

```bash
cd soroban-contracts
make build          # release WASM for both contracts
make test           # full workspace test suite
make lint           # clippy, warnings as errors
```

### Deploy a working demo to testnet

One command handles the whole chain: build, fund a deployer, issue a demo USDC, deploy the
factory, create a vault, open the KYC gate, grant the operator role, and write
`frontend/.env`.

```bash
./scripts/deploy-demo.sh
```

For the step-by-step version, including how to drive the full lifecycle by hand, see
[`frontend/DEPLOYMENT.md`](frontend/DEPLOYMENT.md).

### Run the frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```

It needs `VITE_FACTORY_ADDRESS` in `frontend/.env` — `deploy-demo.sh` writes this for you.
Requires the [Freighter](https://www.freighter.app/) browser extension on Testnet.

## Live testnet deployment

| | |
|---|---|
| Factory | `CDVBDO2GW7445HWUITG6E437GZERAUYBG4X5HZRQC2ZEFMV3Y5HGDY52` |
| Example vault | `CAUZE223Z3225XAS6DTIAV3ZCK4SD3XSKURGALZJNSCW7CW5QYEHF557` |
| Demo asset | `CBCOT7SKDAV5O7AOEBB2G7JTELFKSODKZNXZSVNJQD4HSFYYBHGX2YTE` |

Query any of them directly:

```bash
stellar contract invoke --id <FACTORY> --source-account <KEY> --network testnet \
  -- get_single_rwa_vaults
```

## Security posture

The contracts implement role-based access control, a timelock on critical admin
operations, pausing, address blacklisting, reentrancy locks on every value-moving path,
checks-effects-interactions ordering, and an OpenZeppelin-style virtual offset guarding the
first-depositor share-price inflation attack.

> **These contracts are unaudited and are not intended for production capital.**

Note also what the design does *not* claim: the underlying asset is off-chain, so the
operator is trusted to actually hold it and pay the yield. The contracts constrain and
instrument that trust — they do not remove it. See [`THREAT_MODEL.md`](THREAT_MODEL.md)
and [`SECURITY.md`](SECURITY.md).

## Documentation

- [`soroban-contracts/README.md`](soroban-contracts/README.md) — full contract reference
- [`frontend/DEPLOYMENT.md`](frontend/DEPLOYMENT.md) — deployment and demo walkthrough
- [`MIGRATIONS.md`](MIGRATIONS.md) — storage schema versioning
- [`THREAT_MODEL.md`](THREAT_MODEL.md) — trust assumptions and attack surface
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development workflow
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — common failures

## License

MIT
