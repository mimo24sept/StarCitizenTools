export default function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`section-card ${className}`}>
      <header className="section-header">
        <div className="section-title-stack">
          <h3>{title}</h3>
          <span className="section-rule" />
        </div>
      </header>
      {children}
    </section>
  );
}
