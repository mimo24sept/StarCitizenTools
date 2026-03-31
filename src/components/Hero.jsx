export default function Hero({ visual }) {
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
