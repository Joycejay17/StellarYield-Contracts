import { useCallback, useEffect, useState } from "react";
import { config, isConfigured } from "./config";
import { useWallet } from "./hooks/useWallet";
import { useVaults } from "./hooks/useVaults";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { VaultList } from "./components/VaultList";
import { VaultDetail } from "./components/VaultDetail";
import { Card, Notice } from "./components/ui";

type Route = { name: "landing" } | { name: "vaults" } | { name: "vault"; address: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "landing" });
  const wallet = useWallet();
  useTheme();

  const goVaults = useCallback(() => setRoute({ name: "vaults" }), []);
  const goLanding = useCallback(() => setRoute({ name: "landing" }), []);

  return (
    <>
      <Header
        wallet={wallet}
        onLogoClick={goLanding}
        onLaunch={goVaults}
        showLaunch={route.name === "landing"}
      />

      {route.name === "landing" ? (
        <Landing onLaunch={goVaults} />
      ) : (
        <AppShell
          route={route}
          walletAddress={wallet.address}
          walletError={wallet.error}
          onSelectVault={(address) => setRoute({ name: "vault", address })}
          onBack={goVaults}
        />
      )}

      <ThemeToggle />
    </>
  );
}

function AppShell({
  route,
  walletAddress,
  walletError,
  onSelectVault,
  onBack,
}: {
  route: Route;
  walletAddress: string | null;
  walletError: string | null;
  onSelectVault: (address: string) => void;
  onBack: () => void;
}) {
  if (!isConfigured) return <MissingConfig />;

  return (
    <main>
      {walletError ? (
        <div className="page" style={{ paddingTop: 24 }}>
          <Notice tone="danger">{walletError}</Notice>
        </div>
      ) : null}

      {route.name === "vault" ? (
        <VaultDetail
          vaultAddress={route.address}
          walletAddress={walletAddress}
          onBack={onBack}
        />
      ) : (
        <VaultsRoute onSelectVault={onSelectVault} />
      )}
    </main>
  );
}

function VaultsRoute({ onSelectVault }: { onSelectVault: (address: string) => void }) {
  const { vaults, loading, error, reload } = useVaults();
  return (
    <VaultList
      vaults={vaults}
      loading={loading}
      error={error}
      onSelect={onSelectVault}
      onReload={() => void reload()}
    />
  );
}

/** Shown when no factory address / vault list is configured for this build. */
function MissingConfig() {
  return (
    <main className="page section-tight">
      <Card>
        <div className="stack" style={{ gap: 16 }}>
          <h1 style={{ fontSize: 30 }}>No deployment configured</h1>
          <p className="muted" style={{ fontSize: 15 }}>
            The app needs a VaultFactory contract ID to list vaults. Copy{" "}
            <span className="code">.env.example</span> to{" "}
            <span className="code">.env</span> and set{" "}
            <span className="code">VITE_FACTORY_ADDRESS</span> to the address printed by{" "}
            <span className="code">scripts/deploy-testnet.sh</span>, then restart the dev
            server.
          </p>
          <Notice tone="info">
            Full instructions — build, deploy, create a vault, and fund a test account —
            are in <span className="code">frontend/DEPLOYMENT.md</span>.
          </Notice>
          <p className="faint" style={{ fontSize: 13 }}>
            Current network: {config.network} · RPC: {config.rpcUrl}
          </p>
        </div>
      </Card>
    </main>
  );
}

/** Persisted light/dark preference, matching the reference's corner toggle. */
function useTheme() {
  useEffect(() => {
    const stored = localStorage.getItem("stellaryield-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = stored ?? (prefersDark ? "dark" : "light");
  }, []);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string>(
    () => document.documentElement.dataset.theme ?? "light",
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("stellaryield-theme", next);
    setTheme(next);
  };

  return (
    <button
      className="icon-btn theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title="Toggle theme"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
