import { useState, useEffect } from 'react';
import { toNumber, fmtMoney, fmtNumber } from '../utils/helpers';
import { TRADE_NODES, CARGO_SHIPS, COMBAT_SHIPS, LOADOUT_SLOTS } from '../utils/constants';
import SectionCard from '../components/SectionCard';
import Hero from '../components/Hero';

export default function LoadoutsPage({ db, refreshToken, visual, onMutate }) {
  const [loadouts, setLoadouts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    id: null,
    shipName: COMBAT_SHIPS[0],
    role: "General combat",
    sourceNotes: "",
    loadout: Object.fromEntries(LOADOUT_SLOTS.map((slot) => [slot, { item: "", source: "" }]))
  });

  useEffect(() => {
    setLoadouts(db.getLoadouts());
  }, [db, refreshToken]);

  const selected = loadouts.find((item) => item.id === selectedId);

  async function saveLoadout() {
    await db.saveLoadout(form);
    onMutate();
  }

  async function deleteSelected() {
    if (!selectedId) return;
    await db.deleteLoadout(selectedId);
    setSelectedId(null);
    onMutate();
  }

  return (
    <div className="page-shell">
      <Hero visual={visual} />
      <div className="split-layout even">
        <SectionCard title="Loadout notebook">
          <div className="toolbar-grid compact">
            <select className="app-select" value={form.shipName} onChange={(event) => setForm((current) => ({ ...current, shipName: event.target.value }))}>
              {COMBAT_SHIPS.map((ship) => <option key={ship} value={ship}>{ship}</option>)}
            </select>
            <input className="app-input" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} placeholder="Role" />
            <button className="primary-button small" onClick={saveLoadout}>Save loadout</button>
          </div>

          <div className="loadout-grid">
            {LOADOUT_SLOTS.map((slot) => (
              <div className="loadout-row" key={slot}>
                <span>{slot}</span>
                <input
                  className="app-input"
                  placeholder="Component"
                  value={form.loadout[slot]?.item ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      loadout: { ...current.loadout, [slot]: { ...current.loadout[slot], item: event.target.value } }
                    }))
                  }
                />
                <input
                  className="app-input"
                  placeholder="Where to get it"
                  value={form.loadout[slot]?.source ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      loadout: { ...current.loadout, [slot]: { ...current.loadout[slot], source: event.target.value } }
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <textarea className="app-textarea" value={form.sourceNotes} onChange={(event) => setForm((current) => ({ ...current, sourceNotes: event.target.value }))} placeholder="Mission source notes, alternates, and reminders" />
        </SectionCard>

        <SectionCard title="Saved presets">
          <div className="table-shell medium-table">
            <table className="data-table">
              <thead><tr><th>Ship</th><th>Role</th><th>Updated</th></tr></thead>
              <tbody>
                {loadouts.map((item) => (
                  <tr key={item.id} className={selectedId === item.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)}>
                    <td>{item.shipName}</td>
                    <td>{item.role}</td>
                    <td>{item.updatedAt}</td>
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
                shipName: selected.shipName,
                role: selected.role,
                sourceNotes: selected.sourceNotes ?? "",
                loadout: selected.loadout
              });
            }}>Load selected</button>
            <button className="ghost-button" onClick={deleteSelected} disabled={!selectedId}>Delete selected</button>
          </div>

          {selected ? (
            <div className="text-panel">
              <strong>{selected.shipName} - {selected.role}</strong>
              {LOADOUT_SLOTS.map((slot) => (
                <div className="route-step" key={slot}>
                  <strong>{slot}</strong>
                  <span>{selected.loadout[slot]?.item || "-"}</span>
                  <span>{selected.loadout[slot]?.source || "-"}</span>
                </div>
              ))}
              <div className="source-card">
                <strong>Notes</strong>
                <span>{selected.sourceNotes || "No notes yet."}</span>
              </div>
            </div>
          ) : (
            <p className="empty-text">Select a preset to preview it.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
