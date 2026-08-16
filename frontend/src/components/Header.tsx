import type { WalletState } from "../hooks/useWallet";
import { shortAddress } from "../lib/format";
import { Spinner } from "./ui";

export function Header({
  wallet,
  onLogoClick,
  onLaunch,
  showLaunch,
}: {
  wallet: WalletState;
  onLogoClick: () => void;
  onLaunch?: () => void;
  showLaunch?: boolean;
}) {
  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo" onClick={onLogoClick}>
          <span className="logo-mark">✦</span>
          <span>stellaryield</span>
          <span className="logo-tm">™</span>
        </button>

        <div className="header-actions">
          {showLaunch ? (
            <button className="btn btn-primary" onClick={onLaunch}>
              launch app
            </button>
          ) : (
            <WalletButton wallet={wallet} />
          )}
        </div>
      </div>
    </header>
  );
}

function WalletButton({ wallet }: { wallet: WalletState }) {
  if (!wallet.available) {
    return (
      <a
        className="btn btn-primary"
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
      >
        install freighter
      </a>
    );
  }

  if (wallet.address) {
    return (
      <>
        <span className="address-chip">{shortAddress(wallet.address, 5, 4)}</span>
        <button className="btn btn-ghost" onClick={wallet.disconnect}>
          disconnect
        </button>
      </>
    );
  }

  return (
    <button className="btn btn-primary" onClick={wallet.connect} disabled={wallet.connecting}>
      {wallet.connecting ? <Spinner /> : null}
      {wallet.connecting ? "connecting…" : "connect wallet"}
    </button>
  );
}
