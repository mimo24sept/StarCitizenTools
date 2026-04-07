export default function AppState({ title, subtitle }) {
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
