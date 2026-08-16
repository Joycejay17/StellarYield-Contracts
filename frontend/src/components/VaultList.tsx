import type { VaultSummary } from "../hooks/useVaults";
import { formatAmount, formatDate } from "../lib/format";
import { Card, MicroLabel, Notice, Progress, StateBadge } from "./ui";

export function VaultList({
  vaults,
  loading,
  error,
  onSelect,
  onReload,
}: {
  vaults: VaultSummary[];
  loading: boolean;
  error: string | null;
  onSelect: (address: string) => void;
  onReload: () => void;
}) {
  return (
    <div className="page section-tight">
      <div
        className="row-between"
        style={{ marginBottom: 28, flexWrap: "wrap" }}
      >
        <div className="stack" style={{ gap: 8 }}>
          <h1 style={{ fontSize: 38 }}>Vaults</h1>
        </div>
        <button className="btn btn-ghost" onClick={onReload} disabled={loading}>
          refresh
        </button>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <div className="grid grid-2">
          <div className="skeleton" style={{ height: 200 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      ) : vaults.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <div className="grid grid-2">
          {vaults.map((vault) => (
            <VaultCard key={vault.address} vault={vault} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function VaultCard({
  vault,
  onSelect,
}: {
  vault: VaultSummary;
  onSelect: (address: string) => void;
}) {
  const progress =
    vault.fundingTarget > 0n
      ? Number((vault.totalAssets * 10_000n) / vault.fundingTarget) / 100
      : 0;

  return (
    <Card
      className="vault-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(vault.address)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(vault.address);
      }}
    >
      <div className="stack" style={{ gap: 20 }}>
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 4 }}>
            <div className="card-title">{vault.name}</div>
            <div className="faint" style={{ fontSize: 13 }}>
              {vault.symbol}
              {vault.rwaCategory ? ` · ${vault.rwaCategory}` : ""}
            </div>
          </div>
          <StateBadge state={vault.state} />
        </div>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="card-sunken stack" style={{ gap: 6 }}>
            <MicroLabel>Total assets</MicroLabel>
            <strong style={{ fontSize: 17 }} className="mono">
              {formatAmount(vault.totalAssets, vault.assetDecimals)}
            </strong>
          </div>
          <div className="card-sunken stack" style={{ gap: 6 }}>
            <MicroLabel>Expected APY</MicroLabel>
            <strong style={{ fontSize: 17 }} className="accent mono">
              {vault.expectedApy > 0 ? `${vault.expectedApy / 100}%` : "—"}
            </strong>
          </div>
        </div>

        {vault.state === "Funding" && vault.fundingTarget > 0n ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-between">
              <MicroLabel>Funding progress</MicroLabel>
              <span className="faint mono" style={{ fontSize: 12 }}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress percent={progress} />
          </div>
        ) : (
          <div className="row-between">
            <MicroLabel>Maturity</MicroLabel>
            <span className="mono" style={{ fontSize: 13 }}>
              {formatDate(vault.maturityDate)}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="center-text" style={{ padding: 56 }}>
      <div className="stack" style={{ gap: 12, alignItems: "center" }}>
        <div className="card-title">No vaults found</div>
        <p className="muted" style={{ fontSize: 14, maxWidth: 460 }}>
          The factory has no registered SingleRWA vaults yet. Create one with{" "}
          <span className="code">scripts/create-vault.sh</span>, or pin an
          existing vault via <span className="code">VITE_EXTRA_VAULTS</span>.
          See <span className="code">frontend/DEPLOYMENT.md</span> for the full
          walkthrough.
        </p>
      </div>
    </Card>
  );
}
