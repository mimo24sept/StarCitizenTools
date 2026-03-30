import { useDeferredValue, useEffect, useState } from "react";

import { createDbClient } from "./dbClient";

const PAGE_VISUALS = {
  crafting: [
    { kicker: "Blueprint Matrix", title: "Crafting", subtitle: "Track owned blueprints, preview quality effects, and see what your inventory can actually build." },
    { kicker: "Forge Deck", title: "Crafting", subtitle: "Readable crafting flow from mission source to material quality and final outcome." }
  ],
  trade: [
    { kicker: "C2 Hercules", title: "Trade Routes", subtitle: "Plan efficient cargo loops, visualize the route, and stage a clean overlay path." },
    { kicker: "Caterpillar Lane", title: "Trade Routes", subtitle: "Create routes fast, tune for budget and comfort, and keep them saved locally." }
  ],
  loadouts: [
    { kicker: "Gladius Frame", title: "Loadouts", subtitle: "Build clean ship presets, note where components come from, and keep your fitting notes readable." },
    { kicker: "Combat Deck", title: "Loadouts", subtitle: "A lighter, cleaner fitting notebook while the deeper Erkul-style source layer comes next." }
  ],
  wikelo: [
    { kicker: "Wikelo Intel", title: "Wikelo", subtitle: "Track rare resources, remember how to obtain them, and keep progress between sessions." },
    { kicker: "Rare Material", title: "Wikelo", subtitle: "A practical farming memory layer for the hard-to-find things you never want to lose track of." }
  ]
};

const TRADE_NODES = {
  "Area18": [110, 150],
  "Lorville": [250, 292],
  "Orison": [390, 172],
  "New Babbage": [530, 92],
  "Everus Harbor": [275, 214],
  "Seraphim Station": [375, 118],
  "Pyro Gateway": [625, 220],
  "Ruin Station": [752, 176],
  "Checkmate": [850, 110],
  "Orbituary": [890, 256]
};

const CARGO_SHIPS = ["C2 Hercules", "M2 Hercules", "Caterpillar", "Mercury Star Runner", "Freelancer MAX", "Hull A"];
const COMBAT_SHIPS = ["Arrow", "Gladius", "Hawk", "Talon", "Hornet Mk II", "Sabre", "Scorpius"];
const LOADOUT_SLOTS = ["Power", "Cooler", "Shield", "Quantum", "Weapons", "Missiles", "Utility"];
const QUALITY_PRESETS = [0, 250, 500, 750, 1000];

function randomVisual(page) {
  const set = PAGE_VISUALS[page];
  return set[Math.floor(Math.random() * set.length)];
}

function fmtSeconds(value) {
  if (!value) return "-";
  const minutes = Math.floor(Number(value) / 60);
  const seconds = Number(value) % 60;
  if (minutes && seconds) return `${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getIngredientQualityKey(ingredient) {
  return ingredient?.slot ?? ingredient?.name ?? "?";
}

function clampQuality(value) {
  return Math.max(0, Math.min(1000, toNumber(value, 500)));
}

function AppState({ title, subtitle }) {
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

function Hero({ visual }) {
  return (
    <section className="hero-card">
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

function MetricRow({ items }) {
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

function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`section-card ${className}`}>
      <header className="section-header">
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState("");
  const [activePage, setActivePage] = useState("crafting");
  const [refreshToken, setRefreshToken] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Local data ready");
  const [visuals] = useState({
    crafting: randomVisual("crafting"),
    trade: randomVisual("trade"),
    loadouts: randomVisual("loadouts"),
    wikelo: randomVisual("wikelo")
  });

  useEffect(() => {
    let mounted = true;
    createDbClient()
      .then((client) => {
        if (!mounted) return;
        setDb(client);
        const loadedVersions = client.getVersions();
        setVersions(loadedVersions);
        setVersion(client.getDefaultVersion());
      })
      .catch((err) => {
        if (!mounted) return;
        setError(String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const triggerRefresh = () => setRefreshToken((value) => value + 1);

  async function runSync() {
    if (!db || syncing) return;
    setSyncing(true);
    setSyncMessage("Synchronizing local crafting data...");
    const result = await window.desktopAPI.runSync();
    if (!result.ok) {
      setSyncing(false);
      setSyncMessage("Synchronization failed");
      window.alert(result.stderr || "Sync failed");
      return;
    }
    await db.reloadFromDisk();
    const loadedVersions = db.getVersions();
    setVersions(loadedVersions);
    setVersion(db.getDefaultVersion());
    triggerRefresh();
    setSyncing(false);
    setSyncMessage("Synchronization complete");
  }

  if (loading) return <AppState title="Loading local database" subtitle="Preparing the new desktop shell..." />;
  if (error || !db) return <AppState title="Unable to start the app" subtitle={error || "Unknown initialization error"} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-kicker">mobiGlass inspired</div>
          <h1>Star Citizen Companion</h1>
          <p>Modern local dashboard for crafting, trade routes, loadouts and rare-resource tracking.</p>
        </div>

        <div className="sidebar-card">
          <label className="control-label">Data version</label>
          <select value={version} onChange={(event) => setVersion(event.target.value)} className="app-select">
            {versions.map((item) => (
              <option key={item.version} value={item.version}>
                {item.version}
              </option>
            ))}
          </select>
          <button className="primary-button" onClick={runSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync crafting data"}
          </button>
          <p className="sidebar-status">{syncMessage}</p>
        </div>

        <nav className="nav-list">
          {[
            ["crafting", "Crafting"],
            ["trade", "Trade Routes"],
            ["loadouts", "Loadouts"],
            ["wikelo", "Wikelo"]
          ].map(([key, label]) => (
            <button key={key} className={`nav-button ${activePage === key ? "is-active" : ""}`} onClick={() => setActivePage(key)}>
              <span>{label}</span>
              <small>{visuals[key].kicker}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {activePage === "crafting" && <CraftingPage db={db} version={version} refreshToken={refreshToken} visual={visuals.crafting} onMutate={triggerRefresh} />}
        {activePage === "trade" && <TradePage db={db} refreshToken={refreshToken} visual={visuals.trade} onMutate={triggerRefresh} />}
        {activePage === "loadouts" && <LoadoutsPage db={db} refreshToken={refreshToken} visual={visuals.loadouts} onMutate={triggerRefresh} />}
        {activePage === "wikelo" && <WikeloPage db={db} version={version} refreshToken={refreshToken} visual={visuals.wikelo} onMutate={triggerRefresh} />}
      </main>
    </div>
  );
}

function CraftingPage({ db, version, refreshToken, visual, onMutate }) {
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
  }, [db, version, deferredSearch, category, resource, ownedOnly, missionOnly, missionType, missionLocation, refreshToken]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setSlotQualities({});
      return;
    }
    setDetail(db.getBlueprintDetail(selectedId));
  }, [db, selectedId, refreshToken]);

  const qualityPreview = detail ? db.interpolateQualityEffects(detail, { __default: globalQuality, ...slotQualities }) : [];
  const qualitySlots = detail
    ? (detail.ingredients ?? []).map((ingredient) => ({
        key: getIngredientQualityKey(ingredient),
        slot: ingredient.slot ?? "?",
        material: ingredient.name ?? ingredient.options?.[0]?.name ?? "Unknown",
        value: Number(slotQualities[getIngredientQualityKey(ingredient)] ?? globalQuality)
      }))
    : [];

  useEffect(() => {
    if (!detail) return;
    const next = {};
    for (const ingredient of detail.ingredients ?? []) {
      next[getIngredientQualityKey(ingredient)] = globalQuality;
    }
    setSlotQualities(next);
  }, [detail]);

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

  function shiftGlobalQuality(delta) {
    applyGlobalQuality(globalQuality + delta);
  }

  function shiftSlotQuality(slotKey, delta) {
    updateSlotQuality(slotKey, Number(slotQualities[slotKey] ?? globalQuality) + delta);
  }

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
          <div className="scmdb-segmented">
            <button className="is-active">Tiles</button>
            <button type="button" disabled>
              Table
            </button>
          </div>
        </div>
      </section>

      <div className="scmdb-layout">
        <aside className="scmdb-filters">
          <div className="scmdb-panel-header">FILTERS</div>

          <div className="filter-block">
            <label>SEARCH</label>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="app-input mono-input" placeholder="Title or description..." />
          </div>

          <div className="filter-block">
            <label>CATEGORY</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-select mono-input">
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <label>MATERIAL</label>
            <select value={resource} onChange={(event) => setResource(event.target.value)} className="app-select mono-input">
              <option value="">All materials</option>
              {resources.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <label>COLLECTION</label>
            <button className={`filter-toggle ${ownedOnly ? "is-active" : ""}`} onClick={() => setOwnedOnly((current) => !current)}>
              {ownedOnly ? "Owned only" : "All blueprints"}
            </button>
          </div>

          <div className="filter-block">
            <label>SOURCE</label>
            <button className={`filter-toggle ${missionOnly ? "is-active" : ""}`} onClick={() => setMissionOnly((current) => !current)}>
              {missionOnly ? "Mission blueprints" : "All sources"}
            </button>
          </div>

          <div className="filter-block">
            <label>MISSION TYPE</label>
            <select value={missionType} onChange={(event) => setMissionType(event.target.value)} className="app-select mono-input">
              <option value="">All mission types</option>
              {missionTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-block">
            <label>MISSION LOCATION</label>
            <select value={missionLocation} onChange={(event) => setMissionLocation(event.target.value)} className="app-select mono-input">
              <option value="">All mission locations</option>
              {missionLocations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
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
                  <button className="scmdb-back" onClick={() => setSelectedId(null)}>
                    ← Back to list
                  </button>
                  <strong>{detail.name}</strong>
                  <span>
                    {blueprints.findIndex((item) => item.id === selectedId) + 1} of {blueprints.length} blueprints
                  </span>
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

              <SectionCard title="Craft setup">
                <div className="scmdb-setup-grid">
                  <div className="scmdb-setup-main">
                    <div className="scmdb-action-row">
                      <button className="primary-button small">Craft</button>
                      <button className="secondary-button small" onClick={() => toggleOwnedById(detail.id, detail.owned)}>
                        {detail.owned ? "Unmark owned" : "Mark owned"}
                      </button>
                      <div className="quality-pill">{globalQuality} / 1000</div>
                    </div>
                    <div className="toolbar-grid compact compact-crafting-toolbar">
                      <label className="field-stack">
                        <span>Craft quantity</span>
                        <input className="app-input" type="number" min="1" value={multiplier} onChange={(event) => setMultiplier(Math.max(1, toNumber(event.target.value, 1)))} />
                      </label>
                      <label className="field-stack">
                        <span>All materials</span>
                        <div className="brutalist-stepper">
                          <button className="stepper-button" onClick={() => shiftGlobalQuality(-50)}>
                            -
                          </button>
                          <input className="stepper-input" value={globalQuality} onChange={(event) => applyGlobalQuality(event.target.value)} />
                          <button className="stepper-button" onClick={() => shiftGlobalQuality(50)}>
                            +
                          </button>
                        </div>
                      </label>
                      <div className="scmdb-preset-row">
                        {QUALITY_PRESETS.map((preset) => (
                          <button key={preset} className={`preset-chip ${globalQuality === preset ? "is-active" : ""}`} onClick={() => applyGlobalQuality(preset)}>
                            {preset === 0 ? "Min" : preset === 250 ? "Base" : preset === 500 ? "50%" : preset === 750 ? "High" : "Max"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <div className="segment-card-list">
                {detailSlots.map((slot) => (
                  <SectionCard key={slot.key} title={slot.slot}>
                    <div className="segment-header">
                      <div className="segment-material">
                        <strong>{slot.material}</strong>
                        <span>
                          {slot.required.toFixed(3)} SCU (min {slot.minQuality})
                        </span>
                      </div>
                      <div className="segment-state is-info">
                        {slot.slot}
                      </div>
                    </div>
                    <div className="quality-slider-row">
                      <div className="quality-slider-copy">
                        <strong>Quality</strong>
                        <span>{slot.material}</span>
                      </div>
                      <div className="brutalist-stepper wide">
                        <button className="stepper-button" onClick={() => shiftSlotQuality(slot.key, -50)}>
                          -
                        </button>
                        <input className="stepper-input" value={slot.value} onChange={(event) => updateSlotQuality(slot.key, event.target.value)} />
                        <button className="stepper-button" onClick={() => shiftSlotQuality(slot.key, 50)}>
                          +
                        </button>
                      </div>
                      <div className="mini-preset-row">
                        {[0, 500, 1000].map((preset) => (
                          <button key={preset} className={`mini-preset ${slot.value === preset ? "is-active" : ""}`} onClick={() => updateSlotQuality(slot.key, preset)}>
                            {preset === 0 ? "Min" : preset === 500 ? "50" : "Max"}
                          </button>
                        ))}
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
                <strong>
                  {blueprints.length} of {blueprints.length}
                </strong>
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

function TradePage({ db, refreshToken, visual, onMutate }) {
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

function LoadoutsPage({ db, refreshToken, visual, onMutate }) {
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

function WikeloPage({ db, version, refreshToken, visual, onMutate }) {
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

export default App;
