import { Card, MicroLabel } from "./ui";

/** Soft pastel circles matching the reference's step icons. */
const ICON_TINTS = ["#FDEBD2", "#E7E1FB", "#D6F2E4", "#D7EBFB"];

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <main>
      <Hero onLaunch={onLaunch} />
      <TwoSides />
      <HowItWorks />
      <Lifecycle />
      <Guarantees />
      <FinalCta onLaunch={onLaunch} />
      <Footer />
    </main>
  );
}

function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="section page center-text">
      <div className="stack" style={{ gap: 28, alignItems: "center" }}>
        <span className="eyebrow">✦ Powered by Soroban on Stellar</span>

        <h1 className="hero-title">
          Deposit one asset.
          <br />
          <span className="serif-accent">Earn real-world yield.</span>
        </h1>

        <p className="lede">
          <strong>StellarYield</strong> turns off-chain real-world assets — treasury
          bills, private credit, invoices — into tokenized vaults on Stellar. Deposit a
          stablecoin, receive vault shares, and collect yield that the operator
          distributes on-chain, epoch by epoch, in the asset you started with.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg" onClick={onLaunch}>
            launch app
          </button>
          <a className="btn btn-ghost btn-lg" href="#how-it-works">
            see how it works
          </a>
        </div>
      </div>
    </section>
  );
}

function TwoSides() {
  return (
    <section className="page section-tight">
      <h2 className="section-title center-text" style={{ marginBottom: 40 }}>
        One vault, two roles
      </h2>

      <div className="grid grid-2">
        <RoleCard
          icon="◎"
          tint={ICON_TINTS[2]}
          title="Investors"
          subtitle="Hold stablecoins, want yield"
          depositLabel="You deposit"
          depositValue="USDC"
          earnLabel="You receive"
          earnValue="Vault shares + yield"
        />
        <RoleCard
          icon="◈"
          tint={ICON_TINTS[3]}
          title="Vault operators"
          subtitle="Originate the real-world asset"
          depositLabel="You raise"
          depositValue="A funding round"
          earnLabel="You distribute"
          earnValue="Yield, per epoch"
        />
      </div>

      <p className="lede center-text" style={{ marginTop: 32, maxWidth: 780 }}>
        Every vault is an isolated ERC-4626-style contract holding exactly one
        real-world asset. Shares are SEP-41 tokens, accounting is on-chain, and
        deposits are gated by zkMe KYC when a verifier is configured.
      </p>
    </section>
  );
}

function RoleCard({
  icon,
  tint,
  title,
  subtitle,
  depositLabel,
  depositValue,
  earnLabel,
  earnValue,
}: {
  icon: string;
  tint: string;
  title: string;
  subtitle: string;
  depositLabel: string;
  depositValue: string;
  earnLabel: string;
  earnValue: string;
}) {
  return (
    <Card>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
        <span className="icon-circle" style={{ background: tint, color: "#16181a" }}>
          {icon}
        </span>
        <div>
          <div className="card-title">{title}</div>
          <div className="muted" style={{ fontSize: 14 }}>
            {subtitle}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="card-sunken stack" style={{ gap: 6 }}>
          <MicroLabel>{depositLabel}</MicroLabel>
          <strong style={{ fontSize: 16 }}>{depositValue}</strong>
        </div>
        <div className="card-sunken stack" style={{ gap: 6 }}>
          <MicroLabel>{earnLabel}</MicroLabel>
          <strong style={{ fontSize: 16 }} className="accent">
            {earnValue}
          </strong>
        </div>
      </div>
    </Card>
  );
}

const STEPS = [
  {
    icon: "⇣",
    title: "Deposit",
    body: "While the vault is in Funding, deposit the underlying asset and receive shares 1:1.",
  },
  {
    icon: "↗",
    title: "Vault activates",
    body: "Once the funding target is met, the operator activates the vault and deploys capital off-chain.",
  },
  {
    icon: "◈",
    title: "Yield distributes",
    body: "The operator pays yield into the vault each epoch. It accrues to every shareholder pro-rata.",
  },
  {
    icon: "⇡",
    title: "Claim & redeem",
    body: "Claim accrued yield any time. At maturity, redeem shares back into the underlying asset.",
  },
];

function HowItWorks() {
  return (
    <section className="page section" id="how-it-works">
      <h2 className="section-title center-text" style={{ marginBottom: 40 }}>
        How it works
      </h2>

      <Card>
        <div className="grid grid-4" style={{ gap: 16 }}>
          {STEPS.map((step, i) => (
            <div key={step.title} className="stack center-text" style={{ gap: 12, alignItems: "center" }}>
              <span
                className="icon-circle"
                style={{ background: ICON_TINTS[i % ICON_TINTS.length], color: "#16181a" }}
              >
                {step.icon}
              </span>
              <strong style={{ fontSize: 16 }}>{step.title}</strong>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

const STATES = [
  {
    name: "Funding",
    tone: "badge-info",
    body: "Accepting deposits toward the funding target. Deposits mint shares; the round can be cancelled and refunded if the deadline passes unmet.",
  },
  {
    name: "Active",
    tone: "badge-accent",
    body: "Target met and capital deployed. The operator distributes yield per epoch; holders claim it or request early redemption for a fee.",
  },
  {
    name: "Matured",
    tone: "badge-warn",
    body: "The real-world asset has paid out. Holders redeem shares for principal plus any unclaimed yield.",
  },
  {
    name: "Closed / Cancelled",
    tone: "badge-neutral",
    body: "Terminal. Closed once every share is redeemed; Cancelled when a funding round failed and depositors were refunded.",
  },
];

function Lifecycle() {
  return (
    <section className="page section-tight">
      <div className="center-text stack" style={{ gap: 16, marginBottom: 40 }}>
        <h2 className="section-title">The vault lifecycle</h2>
        <p className="lede">
          Every vault moves through an explicit on-chain state machine. What you can do
          — deposit, claim, redeem — depends entirely on where the vault sits.
        </p>
      </div>

      <div className="grid grid-2">
        {STATES.map((state) => (
          <Card key={state.name} className="card-tight">
            <div className="stack" style={{ gap: 12 }}>
              <span className={`badge ${state.tone}`}>{state.name}</span>
              <p className="muted" style={{ fontSize: 14 }}>
                {state.body}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

const GUARANTEES = [
  {
    title: "KYC-gated deposits",
    body: "Deposits check a zkMe verifier contract. No verifier configured means the vault is open — useful for demos and testnets.",
  },
  {
    title: "ERC-4626 accounting",
    body: "Familiar deposit / mint / withdraw / redeem semantics plus preview functions, so share price is always auditable on-chain.",
  },
  {
    title: "Epoch-based yield",
    body: "Yield is distributed into numbered epochs and accrues pro-rata to holders at the time of distribution — no retroactive dilution.",
  },
  {
    title: "Operator guardrails",
    body: "Role-based access control, a timelock on critical admin actions, pausing, blacklists, and reentrancy locks on every value-moving path.",
  },
];

function Guarantees() {
  return (
    <section className="page section">
      <h2 className="section-title center-text" style={{ marginBottom: 40 }}>
        What the contracts enforce
      </h2>
      <div className="grid grid-2">
        {GUARANTEES.map((item) => (
          <Card key={item.title}>
            <div className="stack" style={{ gap: 10 }}>
              <div className="card-title">{item.title}</div>
              <p className="muted" style={{ fontSize: 14 }}>
                {item.body}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="page section-tight">
      <Card className="center-text" style={{ padding: "56px 28px" }}>
        <div className="stack" style={{ gap: 24, alignItems: "center" }}>
          <h2 className="section-title">
            Ready to see it work?
            <br />
            <span className="serif-accent">Open the app.</span>
          </h2>
          <p className="lede">
            Connect Freighter, pick a vault, and run the full lifecycle — deposit,
            activate, distribute yield, claim, and redeem — against live contracts.
          </p>
          <button className="btn btn-primary btn-lg" onClick={onLaunch}>
            launch app
          </button>
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="page" style={{ padding: "40px 24px 64px" }}>
      <hr className="divider" style={{ marginBottom: 24 }} />
      <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <span className="faint" style={{ fontSize: 13 }}>
          StellarYield — tokenized RWA vaults on Soroban
        </span>
        <span className="faint" style={{ fontSize: 13 }}>
          Demo build. Contracts are unaudited.
        </span>
      </div>
    </footer>
  );
}
