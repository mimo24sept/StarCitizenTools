import { useState, useEffect } from 'react';
import { toNumber, fmtMoney, fmtNumber } from '../utils/helpers';
import { TRADE_NODES, CARGO_SHIPS, COMBAT_SHIPS, LOADOUT_SLOTS } from '../utils/constants';
import SectionCard from '../components/SectionCard';
import Hero from '../components/Hero';

export default function TradePage({ db, refreshToken, visual, onMutate }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [route, setRoute] = useState({
    id: null,
    name: "Primary cargo loop",
    shipName: CARGO_SHIPS[0],
    cargoCapacity: 696,
    investmentBudget: 500000,
    estimatedMinutes: 45,
    origin: "Area18",
    destination: "Lorville",
    routeSteps: [],
    overlayX: 32,
    overlayY: 32,
    overlayScale: 1
  });
  const [stepDraft, setStepDraft] = useState({ location: "Everus Harbor", commodity: "", note: "" });

  useEffect(() => {
    setRoutes(db.getRoutes());
  }, [db, refreshToken]);

  function addStep() {
    if (!stepDraft.location) return;
    setRoute((current) => ({ ...current, routeSteps: [...current.routeSteps, { ...stepDraft }] }));
    setStepDraft((current) => ({ ...current, commodity: "", note: "" }));
  }

  async function saveRoute() {
    await db.saveRoute(route);
    setRoute((current) => ({ ...current, id: null }));
    onMutate();
  }

  async function removeSelectedRoute() {
    if (!selectedRouteId) return;
    await db.deleteRoute(selectedRouteId);
    setSelectedRouteId(null);
    onMutate();
  }

  const routePoints = [route.origin, ...route.routeSteps.map((step) => step.location), route.destination].filter(Boolean);

  return (
    <div className="page-shell">
      <Hero visual={visual} />
      <div className="three-column-layout">
        <SectionCard title="Route builder" className="narrow-card">
          <div className="form-grid">
            <label className="field-stack"><span>Route name</span><input className="app-input" value={route.name} onChange={(event) => setRoute((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="field-stack"><span>Ship</span><select className="app-select" value={route.shipName} onChange={(event) => setRoute((current) => ({ ...current, shipName: event.target.value }))}>{CARGO_SHIPS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field-stack"><span>Cargo capacity</span><input className="app-input" value={route.cargoCapacity} onChange={(event) => setRoute((current) => ({ ...current, cargoCapacity: toNumber(event.target.value) }))} /></label>
            <label className="field-stack"><span>Budget</span><input className="app-input" value={route.investmentBudget} onChange={(event) => setRoute((current) => ({ ...current, investmentBudget: toNumber(event.target.value) }))} /></label>
            <label className="field-stack"><span>Time target</span><input className="app-input" value={route.estimatedMinutes} onChange={(event) => setRoute((current) => ({ ...current, estimatedMinutes: toNumber(event.target.value) }))} /></label>
            <label className="field-stack"><span>Origin</span><select className="app-select" value={route.origin} onChange={(event) => setRoute((current) => ({ ...current, origin: event.target.value }))}>{Object.keys(TRADE_NODES).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field-stack"><span>Destination</span><select className="app-select" value={route.destination} onChange={(event) => setRoute((current) => ({ ...current, destination: event.target.value }))}>{Object.keys(TRADE_NODES).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="field-stack"><span>Overlay X</span><input className="app-input" value={route.overlayX} onChange={(event) => setRoute((current) => ({ ...current, overlayX: toNumber(event.target.value) }))} /></label>
            <label className="field-stack"><span>Overlay Y</span><input className="app-input" value={route.overlayY} onChange={(event) => setRoute((current) => ({ ...current, overlayY: toNumber(event.target.value) }))} /></label>
            <label className="field-stack"><span>Overlay scale</span><input className="app-input" value={route.overlayScale} onChange={(event) => setRoute((current) => ({ ...current, overlayScale: toNumber(event.target.value, 1) }))} /></label>
          </div>

          <div className="subsection">
            <strong>Add route stop</strong>
            <div className="form-grid compact-grid">
              <select className="app-select" value={stepDraft.location} onChange={(event) => setStepDraft((current) => ({ ...current, location: event.target.value }))}>{Object.keys(TRADE_NODES).map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <input className="app-input" placeholder="Cargo" value={stepDraft.commodity} onChange={(event) => setStepDraft((current) => ({ ...current, commodity: event.target.value }))} />
              <input className="app-input" placeholder="Note" value={stepDraft.note} onChange={(event) => setStepDraft((current) => ({ ...current, note: event.target.value }))} />
              <button className="primary-button small" onClick={addStep}>Add stop</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Visual route map">
          <p className="summary-copy">{route.origin} → {route.destination} - {route.shipName} - cargo {route.cargoCapacity} - budget {route.investmentBudget}</p>
          <svg viewBox="0 0 960 360" className="route-map">
            <defs>
              <linearGradient id="routeLine" x1="0%" x2="100%">
                <stop offset="0%" stopColor="#52d3ff" />
                <stop offset="100%" stopColor="#f6a75e" />
              </linearGradient>
            </defs>
            {routePoints.slice(0, -1).map((point, index) => {
              const [x1, y1] = TRADE_NODES[point];
              const [x2, y2] = TRADE_NODES[routePoints[index + 1]];
              return <line key={`${point}-${routePoints[index + 1]}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#routeLine)" strokeWidth="4" strokeLinecap="round" />;
            })}
            {Object.entries(TRADE_NODES).map(([name, [x, y]]) => {
              const active = routePoints.includes(name);
              return (
                <g key={name}>
                  <circle cx={x} cy={y} r={active ? 10 : 7} fill={active ? "#52d3ff" : "#31546a"} />
                  <text x={x} y={y + 24} textAnchor="middle" fill={active ? "#edf5ff" : "#89a9c0"} fontSize="13">{name}</text>
                </g>
              );
            })}
          </svg>
          <div className="text-panel route-intel">
            <strong>Overlay hint</strong>
            <span>Position {route.overlayX}, {route.overlayY} - scale {route.overlayScale}</span>
            {route.routeSteps.map((step, index) => (
              <div className="route-step" key={`${step.location}-${index}`}>
                <strong>{index + 1}. {step.location}</strong>
                <span>{step.commodity || "cargo TBD"}</span>
                <span>{step.note || "no note"}</span>
              </div>
            ))}
            <div className="button-row">
              <button className="primary-button" onClick={saveRoute}>Save route</button>
              <button className="secondary-button" onClick={() => setRoute((current) => ({ ...current, routeSteps: [] }))}>Clear stops</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Saved routes" className="narrow-card">
          <div className="table-shell medium-table">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Ship</th><th>Leg</th></tr></thead>
              <tbody>
                {routes.map((item) => (
                  <tr key={item.id} className={selectedRouteId === item.id ? "is-selected" : ""} onClick={() => setSelectedRouteId(item.id)}>
                    <td>{item.name}</td>
                    <td>{item.shipName}</td>
                    <td>{item.origin} → {item.destination}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={() => {
              const selected = routes.find((item) => item.id === selectedRouteId);
              if (!selected) return;
              setRoute({
                id: selected.id,
                name: selected.name,
                shipName: selected.shipName,
                cargoCapacity: selected.cargoCapacity,
                investmentBudget: selected.investmentBudget,
                estimatedMinutes: selected.estimatedMinutes,
                origin: selected.origin,
                destination: selected.destination,
                routeSteps: selected.routeSteps,
                overlayX: selected.overlayX,
                overlayY: selected.overlayY,
                overlayScale: selected.overlayScale
              });
            }}>Load selected</button>
            <button className="ghost-button" onClick={removeSelectedRoute} disabled={!selectedRouteId}>Delete selected</button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
