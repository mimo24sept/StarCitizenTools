export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIngredientQualityKey(ingredient) {
  return ingredient?.slot ?? ingredient?.name ?? "?";
}

export function clampQuality(value) {
  return Math.max(0, Math.min(1000, toNumber(value, 500)));
}

export function AppState({ title, subtitle }) {
  return (
    <div className="state-shell">
      <div className="state-card">
        <div className="brand-kicker">Star Citizen Companion</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export function Hero({ visual }) {
  return (
    <section className="hero-card">
      <div className="hero-noise" />
      <div className="hero-copy">
        <div className="brand-kicker">{visual.kicker}</div>
        <h2>{visual.title}</h2>
        <p>{visual.subtitle}</p>
      </div>
      <div className="hero-art">
        <div className="art-ring ring-a" />
        <div className="art-ring ring-b" />
        <div className="art-grid" />
      </div>
    </section>
  );
}

export function MetricRow({ items }) {
  return (
    <section className="metric-row">
      {items.map((item) => (
        <div className="metric-card" key={item.label}>
          <span>{item.label}</span>
          <strong style={{ color: item.color }}>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
