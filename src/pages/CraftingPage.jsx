import { useDeferredValue, useEffect, useState } from 'react';
import SectionCard from '../components/SectionCard';
import { clampQuality, fmtSeconds, getIngredientQualityKey, toNumber } from '../utils/helpers';

export default function CraftingPage({
  db,
  version,
  versions,
  syncing,
  syncMessage,
  onVersionChange,
  onSync,
  refreshToken,
  visual,
  onMutate
}) {
  const [categories, setCategories] = useState([]);
  const [resources, setResources] = useState([]);
  const [missionTypes, setMissionTypes] = useState([]);
  const [missionLocations, setMissionLocations] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [resource, setResource] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [missionOnly, setMissionOnly] = useState(false);
  const [missionType, setMissionType] = useState("");
  const [missionLocation, setMissionLocation] = useState("");
  const [blueprints, setBlueprints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [globalQuality, setGlobalQuality] = useState(500);
  const [slotQualities, setSlotQualities] = useState({});
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setCategories(db.getCategories(version));
    setResources(db.getResources(version));
    setMissionTypes(db.getMissionTypes(version));
    setMissionLocations(db.getMissionLocations(version));
  }, [db, version, refreshToken]);

  useEffect(() => {
    const rows = db.searchBlueprints({
      version,
      search: deferredSearch,
      category,
      resource,
      ownedOnly,
      missionOnly,
      missionType,
      missionLocation
    });
    setBlueprints(rows);
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(null);
    }
  }, [db, version, deferredSearch, category, resource, ownedOnly, missionOnly, missionType, missionLocation, refreshToken, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setSlotQualities({});
      return;
    }
    setDetail(db.getBlueprintDetail(selectedId));
  }, [db, selectedId, refreshToken]);

  useEffect(() => {
    if (!detail) return;
    const next = {};
    for (const ingredient of detail.ingredients ?? []) {
      next[getIngredientQualityKey(ingredient)] = globalQuality;
    }
    setSlotQualities(next);
  }, [detail, globalQuality]);

  async function toggleOwnedById(id, owned) {
    await db.setBlueprintOwned(id, !owned);
    onMutate();
  }

  function applyGlobalQuality(nextValue) {
    const value = clampQuality(nextValue);
    setGlobalQuality(value);
    if (!detail) return;
    const next = {};
    for (const ingredient of detail.ingredients ?? []) {
      next[getIngredientQualityKey(ingredient)] = value;
    }
    setSlotQualities(next);
  }

  function updateSlotQuality(slotKey, nextValue) {
    const value = clampQuality(nextValue);
    setSlotQualities((current) => ({
      ...current,
      [slotKey]: value
    }));
  }

  const qualityPreview = detail ? db.interpolateQualityEffects(detail, { __default: globalQuality, ...slotQualities }) : [];
  const qualitySlots = detail
    ? (detail.ingredients ?? []).map((ingredient) => ({
        key: getIngredientQualityKey(ingredient),
        slot: ingredient.slot ?? "?",
        material: ingredient.name ?? ingredient.options?.[0]?.name ?? "Unknown",
        value: Number(slotQualities[getIngredientQualityKey(ingredient)] ?? globalQuality)
      }))
    : [];

  const ownedVisibleCount = blueprints.filter((item) => item.owned).length;
  const selectedMission = detail?.missions?.[0] ?? null;
  const detailSlots = qualitySlots.map((slot) => {
    const ingredient = (detail?.ingredients ?? []).find((item) => getIngredientQualityKey(item) === slot.key) ?? null;
    const primaryOption = ingredient?.options?.[0] ?? null;
    const effects = qualityPreview.filter((item) => item.slot === slot.slot);
    return {
      ...slot,
      required: Number(primaryOption?.quantity_scu ?? ingredient?.quantity_scu ?? 0) * multiplier,
      minQuality: Number(primaryOption?.min_quality ?? 0),
      effects
    };
  });

  return (
    <div className="page-shell scmdb-page">
      <section className="scmdb-topbar">
        <div className="scmdb-topbar-title">
          <span className="scmdb-logo">SCMDB</span>
          <span className="scmdb-sep">//</span>
          <div>
            <strong>Fabricator</strong>
            <span>Blueprint database</span>
          </div>
        </div>
        <div className="scmdb-topbar-actions">
          <div className="scmdb-chip">VER {version}</div>
          <div className="scmdb-chip">{ownedVisibleCount} owned</div>
          <div className="scmdb-sync-inline">
            <select value={version} onChange={(event) => onVersionChange(event.target.value)} className="app-select scmdb-select">
              {versions.map((item) => (
                <option key={item.version} value={item.version}>
                  {item.version}
                </option>
              ))}
            </select>
            <button className="primary-button small" onClick={onSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync crafting data"}
            </button>
          </div>
          <div className="scmdb-segmented">
            <button className="is-active">Tiles</button>
            <button type="button" disabled>Table</button>
          </div>
        </div>
      </section>

      <div className="scmdb-layout">
        <aside className="scmdb-filters">
          <div className="scmdb-panel-header">FILTERS</div>

          <div className="filter-block">
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="app-input mono-input" placeholder="Search blueprints..." aria-label="Search blueprints" />
          </div>

          <div className="filter-block">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-select mono-input">
              <option value="">Category</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <select value={resource} onChange={(event) => setResource(event.target.value)} className="app-select mono-input">
              <option value="">Material</option>
              {resources.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <button className={`filter-toggle ${ownedOnly ? "is-active" : ""}`} onClick={() => setOwnedOnly((current) => !current)}>
              {ownedOnly ? "Owned only" : "All blueprints"}
            </button>
          </div>

          <div className="filter-block">
            <button className={`filter-toggle ${missionOnly ? "is-active" : ""}`} onClick={() => setMissionOnly((current) => !current)}>
              {missionOnly ? "Mission blueprints" : "All sources"}
            </button>
          </div>

          <div className="filter-block">
            <select value={missionType} onChange={(event) => setMissionType(event.target.value)} className="app-select mono-input">
              <option value="">Mission type</option>
              {missionTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <select value={missionLocation} onChange={(event) => setMissionLocation(event.target.value)} className="app-select mono-input">
              <option value="">Mission location</option>
              {missionLocations.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <button
            className="scmdb-reset"
            onClick={() => {
              setSearch("");
              setCategory("");
              setResource("");
              setOwnedOnly(false);
              setMissionOnly(false);
              setMissionType("");
              setMissionLocation("");
            }}
          >
            Reset filters
          </button>
        </aside>

        <section className="scmdb-results">
          {detail ? (
            <div className="scmdb-detail-view">
              <div className="scmdb-results-header scmdb-detail-header">
                <div className="scmdb-detail-heading">
                  <button className="scmdb-back" onClick={() => setSelectedId(null)}>← Back to list</button>
                  <strong>{detail.name}</strong>
                  <span>{blueprints.findIndex((item) => item.id === selectedId) + 1} of {blueprints.length} blueprints</span>
                </div>
                <div className="scmdb-card-badges">
                  <span className="scmdb-tag cyan">{detail.category || "Blueprint"}</span>
                  {selectedMission ? <span className="scmdb-tag purple">Mission BP</span> : null}
                  {detail.owned ? <span className="scmdb-tag green">Owned</span> : <span className="scmdb-tag amber">Missing</span>}
                </div>
              </div>

              {selectedMission ? (
                <div className="scmdb-mission-inline">
                  <span>MISSION</span>
                  <strong>{selectedMission.name || "-"}</strong>
                  <small>
                    {selectedMission.mission_type || "Unknown type"}
                    {selectedMission.contractor ? ` - ${selectedMission.contractor}` : ""}
                    {selectedMission.locations ? ` - ${selectedMission.locations}` : ""}
                  </small>
                </div>
              ) : null}

              <SectionCard title="Craft setup" className="craft-setup-card">
                <div className="craft-setup-shell">
                  <div className="scmdb-action-row craft-action-row">
                    <button className="primary-button small">Craft</button>
                    <div className="quality-pill">{globalQuality} / 1000</div>
                    <div className="craft-setup-meta">{detailSlots.length} segments</div>
                  </div>

                  <div className="craft-setup-grid">
                    <label className="field-stack craft-quantity-field">
                      <span>Craft quantity</span>
                      <input className="app-input" type="number" min="1" value={multiplier} onChange={(event) => setMultiplier(Math.max(1, toNumber(event.target.value, 1)))} />
                    </label>

                    <div className="craft-global-panel">
                      <span className="craft-global-label">All materials</span>
                      <div className="craft-slider-shell">
                        <div className="craft-slider-row">
                          <input
                            className="craft-range"
                            type="range"
                            min="0"
                            max="1000"
                            step="10"
                            value={globalQuality}
                            onChange={(event) => applyGlobalQuality(event.target.value)}
                          />
                          <input
                            className="app-input craft-range-input"
                            type="number"
                            min="0"
                            max="1000"
                            step="10"
                            value={globalQuality}
                            onChange={(event) => applyGlobalQuality(event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <div className="segment-card-list">
                {detailSlots.map((slot) => (
                  <SectionCard key={slot.key} title={slot.slot} className="segment-card">
                    <div className="segment-header">
                      <div className="segment-material">
                        <strong>{slot.material}</strong>
                        <span>{slot.required.toFixed(3)} SCU (min {slot.minQuality})</span>
                      </div>
                    </div>
                    <div className="quality-slider-row compact-quality-row">
                      <div className="quality-slider-copy">
                        <strong>Quality</strong>
                      </div>
                      <div className="segment-slider-shell">
                        <div className="segment-slider-row">
                          <input
                            className="craft-range"
                            type="range"
                            min="0"
                            max="1000"
                            step="10"
                            value={slot.value}
                            onChange={(event) => updateSlotQuality(slot.key, event.target.value)}
                          />
                          <input
                            className="app-input segment-quality-input"
                            type="number"
                            min="0"
                            max="1000"
                            step="10"
                            value={slot.value}
                            onChange={(event) => updateSlotQuality(slot.key, event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="segment-effects">
                      {slot.effects.length ? (
                        slot.effects.map((effect) => (
                          <div className="segment-effect-row" key={`${slot.key}-${effect.stat}`}>
                            <span>{effect.stat}</span>
                            <strong>
                              x{effect.modifier.toFixed(3)} {effect.modifierPercent >= 0 ? "+" : ""}
                              {effect.modifierPercent.toFixed(1)}%
                            </strong>
                          </div>
                        ))
                      ) : (
                        <p className="empty-text">No modifier data for this segment.</p>
                      )}
                    </div>
                  </SectionCard>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="scmdb-results-header">
                <strong>{blueprints.length} of {blueprints.length}</strong>
                <span>Crafting blueprints</span>
              </div>

              <div className="blueprint-grid scmdb-grid">
                {blueprints.map((item) => (
                  <article
                    key={item.id}
                    className={`blueprint-card scmdb-card ${selectedId === item.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                  >
                    <div className="scmdb-card-head">
                      <div className="scmdb-card-code">{(item.category || "BP").slice(0, 2).toUpperCase()}</div>
                      <div className="scmdb-card-titleblock">
                        <div className="scmdb-card-badges">
                          <span className="scmdb-tag cyan">{item.category || "Blueprint"}</span>
                          {item.hasMission ? <span className="scmdb-tag purple">Mission BP</span> : null}
                          {item.owned ? <span className="scmdb-tag green">Owned</span> : <span className="scmdb-tag amber">Missing</span>}
                        </div>
                        <strong>{item.name}</strong>
                        <span className="scmdb-subcopy">{item.category || "Unknown category"}</span>
                      </div>
                    </div>

                    <div className="scmdb-card-footer">
                      <div className="scmdb-card-stats">
                        <span>TIME {fmtSeconds(item.craftTimeSeconds)}</span>
                        <span>TIERS {item.tiers || "-"}</span>
                      </div>
                      <button
                        className="tile-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleOwnedById(item.id, item.owned);
                        }}
                      >
                        {item.owned ? "Owned" : "Mark owned"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
