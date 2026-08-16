import { useState } from "react";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import type { VaultData, UserData } from "../hooks/useVaultData";
import { useTransaction } from "../hooks/useTransaction";
import { formatAmount, parseAmount } from "../lib/format";
import { AmountInput, Card, MicroLabel, Notice, Spinner } from "./ui";
import { TxStatus } from "./TxStatus";

const addr = (a: string) => Address.fromString(a).toScVal();
const i128 = (v: bigint) => nativeToScVal(v, { type: "i128" });
const u64 = (v: bigint) => nativeToScVal(v, { type: "u64" });

/**
 * Operator-only lifecycle controls. Without these the demo cannot show a vault
 * moving Funding → Active → (yield) → Matured, so they live alongside the
 * investor actions rather than in a separate admin app.
 */
export function OperatorPanel({
  vault,
  user,
  walletAddress,
  onRefresh,
}: {
  vault: VaultData;
  user: UserData;
  walletAddress: string;
  onRefresh: () => Promise<void>;
}) {
  const tx = useTransaction(onRefresh);
  const [yieldAmount, setYieldAmount] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const targetMet = vault.totalAssets >= vault.fundingTarget;
  const maturityReached = vault.timeToMaturity === 0n;

  const distribute = async () => {
    setInputError(null);
    let amount: bigint;
    try {
      amount = parseAmount(yieldAmount, vault.assetDecimals);
    } catch (err) {
      setInputError((err as Error).message);
      return;
    }
    if (amount > user.assetBalance) {
      setInputError(
        `Your balance is only ${formatAmount(user.assetBalance, vault.assetDecimals)} ${vault.assetSymbol}`,
      );
      return;
    }
    const ok = await tx.run({
      action: "Distribute yield",
      contractId: vault.address,
      method: "distribute_yield",
      args: [addr(walletAddress), i128(amount)],
      walletAddress,
    });
    if (ok) setYieldAmount("");
  };

  return (
    <Card>
      <div className="stack" style={{ gap: 20 }}>
        <div className="row-between">
          <div className="card-title">Operator controls</div>
          <span className="badge badge-neutral">Operator</span>
        </div>

        {vault.state === "Funding" ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted" style={{ fontSize: 14 }}>
              Activating closes the funding round and moves the vault to Active, where
              yield can be distributed. Requires the funding target to be met.
            </p>
            {!targetMet ? (
              <Notice tone="warn">
                Funding target not met yet —{" "}
                {formatAmount(vault.fundingTarget - vault.totalAssets, vault.assetDecimals)}{" "}
                {vault.assetSymbol} still needed.
              </Notice>
            ) : null}
            <button
              className="btn btn-primary btn-block"
              disabled={tx.busy || !targetMet}
              onClick={() =>
                tx.run({
                  action: "Activate vault",
                  contractId: vault.address,
                  method: "activate_vault",
                  args: [addr(walletAddress)],
                  walletAddress,
                })
              }
            >
              {tx.busy ? <Spinner /> : null}
              {tx.busy ? "processing…" : "activate vault"}
            </button>
          </div>
        ) : null}

        {vault.state === "Active" ? (
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 12 }}>
              <div className="field">
                <div className="row-between">
                  <MicroLabel>Distribute yield</MicroLabel>
                  <span className="faint" style={{ fontSize: 12 }}>
                    Balance: {formatAmount(user.assetBalance, vault.assetDecimals)}{" "}
                    {vault.assetSymbol}
                  </span>
                </div>
                <AmountInput
                  value={yieldAmount}
                  onChange={setYieldAmount}
                  suffix={vault.assetSymbol}
                  disabled={tx.busy}
                />
              </div>
              <span className="faint" style={{ fontSize: 12 }}>
                Transfers {vault.assetSymbol} from your wallet into the vault and opens
                epoch {vault.currentEpoch + 1}. Every current shareholder can then claim
                their pro-rata share.
              </span>
              {inputError ? <Notice tone="danger">{inputError}</Notice> : null}
              <button
                className="btn btn-primary btn-block"
                onClick={distribute}
                disabled={tx.busy || !yieldAmount || vault.totalSupply <= 0n}
              >
                {tx.busy ? <Spinner /> : null}
                {tx.busy ? "processing…" : "distribute yield"}
              </button>
            </div>

            <hr className="divider" />

            <div className="stack" style={{ gap: 12 }}>
              <p className="muted" style={{ fontSize: 14 }}>
                Maturing the vault enables full redemptions. The contract requires the
                maturity date to have passed.
              </p>
              {!maturityReached ? (
                <Notice tone="info">
                  Maturity is still in the future. For a demo, bring it forward first —
                  this calls <span className="code">set_maturity_date</span> with the
                  current time.
                </Notice>
              ) : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!maturityReached ? (
                  <button
                    className="btn btn-soft"
                    disabled={tx.busy}
                    onClick={() =>
                      tx.run({
                        action: "Set maturity date",
                        contractId: vault.address,
                        method: "set_maturity_date",
                        args: [
                          addr(walletAddress),
                          u64(BigInt(Math.floor(Date.now() / 1000))),
                        ],
                        walletAddress,
                      })
                    }
                  >
                    bring maturity forward
                  </button>
                ) : null}
                <button
                  className="btn btn-primary"
                  disabled={tx.busy || !maturityReached}
                  onClick={() =>
                    tx.run({
                      action: "Mature vault",
                      contractId: vault.address,
                      method: "mature_vault",
                      args: [addr(walletAddress)],
                      walletAddress,
                    })
                  }
                >
                  {tx.busy ? <Spinner /> : null}
                  mature vault
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {vault.state === "Matured" ? (
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted" style={{ fontSize: 14 }}>
              Closing is the terminal step and requires every share to have been
              redeemed.
            </p>
            {vault.totalSupply > 0n ? (
              <Notice tone="info">
                {formatAmount(vault.totalSupply, vault.shareDecimals)} {vault.symbol}{" "}
                still outstanding — the vault cannot be closed yet.
              </Notice>
            ) : null}
            <button
              className="btn btn-primary btn-block"
              disabled={tx.busy || vault.totalSupply > 0n}
              onClick={() =>
                tx.run({
                  action: "Close vault",
                  contractId: vault.address,
                  method: "close_vault",
                  args: [addr(walletAddress)],
                  walletAddress,
                })
              }
            >
              {tx.busy ? <Spinner /> : null}
              close vault
            </button>
          </div>
        ) : null}

        {vault.state === "Closed" || vault.state === "Cancelled" ? (
          <Notice>This vault is in a terminal state. No operator actions remain.</Notice>
        ) : null}

        <TxStatus state={tx.state} onDismiss={tx.reset} />
      </div>
    </Card>
  );
}
