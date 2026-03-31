import { useState, useEffect } from 'react';
import { toNumber, fmtMoney, fmtNumber } from '../utils/helpers';
import { TRADE_NODES, CARGO_SHIPS, COMBAT_SHIPS, LOADOUT_SLOTS } from '../utils/constants';
import SectionCard from '../components/SectionCard';
import Hero from '../components/Hero';
import { getIngredientQualityKey } from '../utils/helpers';

export default function WikeloPage({ db, version, refreshToken, visual, onMutate }) {
  const [resources, setResources] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    id: null,
    name: "",
    targetQuantity: "",
    currentQuantity: "",
    rarity: "Rare",
    sessionDelta: "",
    sourceNotes: ""
  });

  useEffect(() => {
    setResources(db.getResources(version));
    setTracked(db.getTrackedResources());
  }, [db, version, refreshToken]);

  const selected = tracked.find((item) => item.id === selectedId);
  const progress = selected && Number(selected.targetQuantity) > 0 ? Math.min(100, (Number(selected.currentQuantity) / Number(selected.targetQuantity)) * 100) : 0;

  async function saveTracked() {
    if (!form.name.trim()) return;
    await db.saveTrackedResource({
      ...form,
      targetQuantity: toNumber(form.targetQuantity),
      currentQuantity: toNumber(form.currentQuantity),
      sessionDelta: toNumber(form.sessionDelta)
    });
    onMutate();
  }

  async function deleteTracked() {
    if (!selectedId) return;
    await db.deleteTrackedResource(selectedId);
    setSelectedId(null);
    onMutate();
  }

  return (
    <div className="page-shell">
      <Hero visual={visual} />
      <div className="split-layout even">
        <SectionCard title="Track rare resources">
          <div className="toolbar-grid compact">
            <select className="app-select" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}>
              <option value="">Choose a resource</option>
              {resources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input className="app-input" placeholder="Target qty" value={form.targetQuantity} onChange={(event) => setForm((current) => ({ ...current, targetQuantity: event.target.value }))} />
            <input className="app-input" placeholder="Current qty" value={form.currentQuantity} onChange={(event) => setForm((current) => ({ ...current, currentQuantity: event.target.value }))} />
            <select className="app-select" value={form.rarity} onChange={(event) => setForm((current) => ({ ...current, rarity: event.target.value }))}>
              {["Common", "Uncommon", "Rare", "Very Rare"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input className="app-input" placeholder="Session delta" value={form.sessionDelta} onChange={(event) => setForm((current) => ({ ...current, sessionDelta: event.target.value }))} />
          </div>
          <textarea className="app-textarea" placeholder="How to obtain it, cave notes, mission reminders, best place to look..." value={form.sourceNotes} onChange={(event) => setForm((current) => ({ ...current, sourceNotes: event.target.value }))} />
          <div className="button-row">
            <button className="primary-button" onClick={saveTracked}>Save tracked resource</button>
            <button className="secondary-button" onClick={() => setForm({ id: null, name: "", targetQuantity: "", currentQuantity: "", rarity: "Rare", sessionDelta: "", sourceNotes: "" })}>Clear form</button>
          </div>
        </SectionCard>

        <SectionCard title="Tracked list">
          <div className="table-shell medium-table">
            <table className="data-table">
              <thead><tr><th>Resource</th><th>Rarity</th><th>Target</th><th>Current</th><th>Delta</th></tr></thead>
              <tbody>
                {tracked.map((item) => (
                  <tr key={item.id} className={selectedId === item.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}>
                    <td>{item.name}</td>
                    <td>{item.rarity}</td>
                    <td>{item.targetQuantity}</td>
                    <td>{item.currentQuantity}</td>
                    <td>{item.sessionDelta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={() => {
              if (!selected) return;
              setForm({
                id: selected.id,
                name: selected.name,
                targetQuantity: String(selected.targetQuantity ?? ""),
                currentQuantity: String(selected.currentQuantity ?? ""),
                rarity: selected.rarity,
                sessionDelta: String(selected.sessionDelta ?? ""),
                sourceNotes: selected.sourceNotes ?? ""
              });
            }}>Load selected</button>
            <button className="ghost-button" onClick={deleteTracked} disabled={!selectedId}>Delete selected</button>
          </div>

          {selected ? (
            <div className="text-panel">
              <strong>{selected.name} - {selected.rarity}</strong>
              <span>Progress: {progress.toFixed(1)}%</span>
              <span>Current {selected.currentQuantity} / Target {selected.targetQuantity}</span>
              <span>Session delta: {Number(selected.sessionDelta) >= 0 ? "+" : ""}{selected.sessionDelta}</span>
              <div className="source-card">
                <strong>How to obtain it</strong>
                <span>{selected.sourceNotes || "No notes yet."}</span>
              </div>
            </div>
          ) : (
            <p className="empty-text">Select a tracked resource to preview it.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
