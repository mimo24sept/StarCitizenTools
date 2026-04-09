import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import {
  enrichMineral,
  enrichMiningComponent,
  formatMiningTerminal,
  getMiningCategories,
  getMiningComponents,
  getMiningMinerals,
  getMiningShips,
  getSuggestedBuilds,
  loadMiningSnapshot
} from "../miningData";

const FOCUS_OPTIONS = [
  ["stability", "Stability"],
  ["fracture", "Fracture"],
  ["extraction", "Extraction"]
];

const CATEGORY_LABELS = {
  "Mining Laser Heads": "Heads",
  "Mining Modules": "Modules",
  Gadgets: "Gadgets"
};

const ATTRIBUTE_PRIORITIES = {
  stability: ["Laser Instability", "Optimal Charge Window Rate", "Optimal Charge Window Size", "Resistance"],
  fracture: ["Mining Laser Power", "Resistance", "Optimal Charge Window Rate", "Optimal Range"],
  extraction: ["Extraction Laser Power", "Collection Throughput", "Collection Point Radius", "Optimal Range"]
};

function normalizeAttribute(item) {
  if (!item?.value) return "";
  return `${item.value}${item.unit ? ` ${item.unit}` : ""}`.trim();
}

function pickComponentHighlights(component, focus) {
  if (!component?.attributes?.length) return [];
  const priorities = ATTRIBUTE_PRIORITIES[focus] ?? ATTRIBUTE_PRIORITIES.stability;
  const mapped = priorities
    .map((name) => component.attributes.find((attribute) => attribute.attributeName === name))
    .filter(Boolean)
    .map((attribute) => ({
      label: attribute.attributeName,
      value: normalizeAttribute(attribute)
    }))
    .filter((attribute) => attribute.value);

  if (mapped.length) {
    return mapped.slice(0, 3);
  }

  return component.attributes
    .map((attribute) => ({
      label: attribute.attributeName,
      value: normalizeAttribute(attribute)
    }))
    .filter((attribute) => attribute.value)
    .slice(0, 3);
}

function getMineralShipHint(mineral) {
  const miningType = (mineral?.intel?.miningType || "").toLowerCase();
  if (miningType.includes("roc") || miningType.includes("hand")) {
    return "Greycat ROC / ROC-DS";
  }
  return "Prospector / MOLE / Arrastra";
}

function BuildRecommendationGroup({ title, subtitle, items, focus }) {
  return (
    <div className="mining-build-group">
      <div className="mining-build-group-head">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className="mining-build-group-list">
        {items.length ? (
          items.map((item) => {
            const highlights = pickComponentHighlights(item, focus);
            return (
              <div className="mining-build-item" key={`${title}-${item.id}`}>
                <div className="mining-build-item-head">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.manufacturer || item.categoryName}</span>
                  </div>
                  <div className="mining-build-item-pills">
                    {item.size ? <span className="trade-pill">{`S${item.size}`}</span> : null}
                    {item.bestBuy ? (
                      <span className="trade-pill safe">{`${Number(item.bestBuy.priceBuy).toLocaleString("en-US")} aUEC`}</span>
                    ) : null}
                  </div>
                </div>

                {highlights.length ? (
                  <div className="trade-inline-stats mining-inline-stats">
                    {highlights.map((attribute) => (
                      <span key={`${item.id}-${attribute.label}`}>
                        {attribute.label}: {attribute.value}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mining-build-item-footer">
                  {item.bestBuy ? (
                    <span>Buy at {formatMiningTerminal(item.bestBuy.terminal)}</span>
                  ) : (
                    <span>No live buy location found</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="source-card mining-empty-card">
            <strong>No recommendation</strong>
            <span>No matching component was found for this ship and focus.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MiningPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedShipName, setSelectedShipName] = useState("");
  const [componentCategory, setComponentCategory] = useState("Mining Laser Heads");
  const [componentSearch, setComponentSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState(0);
  const [mineralSearch, setMineralSearch] = useState("");
  const [selectedMineralId, setSelectedMineralId] = useState(0);
  const [focus, setFocus] = useState("stability");
  const [viewMode, setViewMode] = useState("builds");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const data = await loadMiningSnapshot();
      if (!mounted) return;
      setSnapshot(data);
      setLoading(false);
      setError(data ? "" : "No mining snapshot yet. Run a mining sync first.");
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function runMiningSync() {
    setSyncing(true);
    const result = await window.desktopAPI.runMiningSync();
    setSyncing(false);
    if (!result?.ok) {
      setError(result?.error || "Mining sync failed");
      return;
    }
    const data = await loadMiningSnapshot();
    setSnapshot(data);
    setError("");
  }

  const ships = useMemo(() => getMiningShips(snapshot), [snapshot]);
  const categories = useMemo(() => getMiningCategories(snapshot), [snapshot]);

  useEffect(() => {
    if (!ships.length) {
      setSelectedShipName("");
      return;
    }
    if (!ships.some((item) => (item.fullName || item.name) === selectedShipName)) {
      setSelectedShipName(ships[0].fullName || ships[0].name);
    }
  }, [ships, selectedShipName]);

  useEffect(() => {
    if (!categories.length) return;
    if (categories.includes(componentCategory)) return;
    setComponentCategory(categories[0]);
  }, [categories, componentCategory]);

  const selectedShip = ships.find((item) => (item.fullName || item.name) === selectedShipName) ?? null;

  const suggestedBuilds = useMemo(() => {
    const builds = getSuggestedBuilds(snapshot, selectedShip, focus);
    const headCount = Math.max(1, Number(selectedShip?.profile?.headCount || 1));
    const moduleSlots = Math.max(1, Number(selectedShip?.profile?.moduleSlots || 1));
    return {
      heads: builds.heads.map((item) => enrichMiningComponent(item, snapshot)).slice(0, headCount),
      modules: builds.modules.map((item) => enrichMiningComponent(item, snapshot)).slice(0, moduleSlots),
      gadgets: builds.gadgets.map((item) => enrichMiningComponent(item, snapshot)).slice(0, 2)
    };
  }, [snapshot, selectedShip, focus]);

  useEffect(() => {
    if (selectedShip?.profile?.headSize && componentCategory === "Mining Laser Heads") {
      setSizeFilter(selectedShip.profile.headSize);
    }
  }, [selectedShip, componentCategory]);

  const components = useMemo(
    () => getMiningComponents(snapshot, componentCategory, componentSearch, sizeFilter),
    [snapshot, componentCategory, componentSearch, sizeFilter]
  );

  useEffect(() => {
    if (!components.length) {
      setSelectedComponentId(0);
      return;
    }
    if (!components.some((item) => Number(item.id) === Number(selectedComponentId))) {
      setSelectedComponentId(components[0].id);
    }
  }, [components, selectedComponentId]);

  const selectedComponent = useMemo(
    () => enrichMiningComponent(components.find((item) => Number(item.id) === Number(selectedComponentId)) ?? null, snapshot),
    [components, selectedComponentId, snapshot]
  );

  const minerals = useMemo(() => getMiningMinerals(snapshot, mineralSearch), [snapshot, mineralSearch]);

  useEffect(() => {
    if (!minerals.length) {
      setSelectedMineralId(0);
      return;
    }
    if (!minerals.some((item) => Number(item.id) === Number(selectedMineralId))) {
      setSelectedMineralId(minerals[0].id);
    }
  }, [minerals, selectedMineralId]);

  const selectedMineral = useMemo(
    () => enrichMineral(minerals.find((item) => Number(item.id) === Number(selectedMineralId)) ?? null, snapshot),
    [minerals, selectedMineralId, snapshot]
  );

  if (loading) {
    return (
      <div className="state-shell">
        <div className="state-card">
          <h1>Loading mining intel</h1>
          <p>Preparing ships, laser heads, modules and mineral data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell mining-page">
      <section className="scmdb-topbar">
        <div className="scmdb-topbar-title">
          <span className="scmdb-logo">MINING</span>
          <span className="scmdb-sep">//</span>
          <div>
            <strong>Resource Extraction</strong>
            <span>Ships, setups and where to search each mineral</span>
          </div>
        </div>
        <div className="scmdb-topbar-actions">
          <div className="scmdb-segmented">
            <button className={viewMode === "builds" ? "is-active" : ""} onClick={() => setViewMode("builds")}>
              Builds
            </button>
            <button className={viewMode === "minerals" ? "is-active" : ""} onClick={() => setViewMode("minerals")}>
              Where to mine
            </button>
          </div>
          <button className="primary-button small" onClick={runMiningSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync mining data"}
          </button>
        </div>
      </section>

      {!snapshot ? (
        <div className="state-shell">
          <div className="state-card">
            <h1>No mining snapshot</h1>
            <p>{error || "Run a mining sync to populate the page."}</p>
            <div className="button-row">
              <button className="primary-button" onClick={runMiningSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync mining data"}
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === "builds" ? (
        <div className="split-layout mining-workspace">
          <SectionCard title="Ship" className="mining-column-card">
            <div className="mining-panel-scroll">
              <div className="trade-filter-block mining-form-stack">
                <select className="app-select" value={selectedShipName} onChange={(event) => setSelectedShipName(event.target.value)}>
                  {ships.map((ship) => (
                    <option key={ship.id} value={ship.fullName || ship.name}>
                      {ship.fullName || ship.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedShip ? (
                <>
                  <div className="mining-ship-hero">
                    <div>
                      <strong>{selectedShip.fullName || selectedShip.name}</strong>
                      <span>{selectedShip.manufacturer || "Unknown maker"}</span>
                    </div>
                    <div className="mining-ship-metrics">
                      <span>{selectedShip.profile?.type || "Mining platform"}</span>
                      {selectedShip.profile?.headSize ? <span>{`Head S${selectedShip.profile.headSize}`}</span> : null}
                      {selectedShip.profile?.moduleSlots ? <span>{`${selectedShip.profile.moduleSlots} module slots`}</span> : null}
                    </div>
                    {selectedShip.profile?.notes ? <p className="summary-copy compact">{selectedShip.profile.notes}</p> : null}
                  </div>

                  <div className="mining-build-toolbar">
                    {FOCUS_OPTIONS.map(([key, label]) => (
                      <button
                        key={key}
                        className={`filter-toggle ${focus === key ? "is-active" : ""}`}
                        onClick={() => setFocus(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-text">No mining ship available in the current snapshot.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recommended setup" className="mining-column-card">
            <div className="mining-panel-scroll">
              {selectedShip ? (
                <>
                  <div className="mining-build-grid">
                    <BuildRecommendationGroup
                      title={Number(selectedShip.profile?.headCount || 1) > 1 ? "Laser heads" : "Laser head"}
                      subtitle={
                        selectedShip.profile?.headSize
                          ? `${selectedShip.profile?.headCount || 1} x size ${selectedShip.profile.headSize}`
                          : "Best match"
                      }
                      items={suggestedBuilds.heads}
                      focus={focus}
                    />
                    <BuildRecommendationGroup
                      title="Modules"
                      subtitle={selectedShip.profile?.moduleSlots ? `${selectedShip.profile.moduleSlots} slot${selectedShip.profile.moduleSlots > 1 ? "s" : ""}` : "Recommended picks"}
                      items={suggestedBuilds.modules}
                      focus={focus}
                    />
                    <BuildRecommendationGroup title="Gadgets" subtitle="Optional utility picks" items={suggestedBuilds.gadgets} focus={focus} />
                  </div>

                  <div className="mining-browser-shell">
                    <div className="mining-browser-toolbar">
                      <div className="trade-chip-input-row">
                        {categories.map((item) => (
                          <button
                            key={item}
                            className={`filter-toggle ${componentCategory === item ? "is-active" : ""}`}
                            onClick={() => setComponentCategory(item)}
                          >
                            {CATEGORY_LABELS[item] || item}
                          </button>
                        ))}
                      </div>
                      <div className="trade-chip-input-row">
                        <input
                          className="app-input"
                          value={componentSearch}
                          onChange={(event) => setComponentSearch(event.target.value)}
                          placeholder="Search component..."
                        />
                        <input
                          className="app-input"
                          value={sizeFilter}
                          onChange={(event) => setSizeFilter(event.target.value)}
                          placeholder={componentCategory === "Mining Laser Heads" ? "Size" : "Any size"}
                        />
                      </div>
                    </div>

                    <div className="mining-component-layout">
                      <div className="mining-component-list">
                        {components.map((item) => (
                          <button
                            key={item.id}
                            className={`wikelo-recipe-card ${selectedComponentId === item.id ? "is-selected" : ""}`}
                            onClick={() => setSelectedComponentId(item.id)}
                          >
                            <div className="wikelo-recipe-card-head">
                              <strong>{item.name}</strong>
                              {item.size ? <span className="trade-pill">{`S${item.size}`}</span> : null}
                            </div>
                            <div className="wikelo-recipe-card-meta">
                              <span>{item.manufacturer || "Unknown maker"}</span>
                              <span>{item.typeLabel || item.categoryName}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="mining-component-detail">
                        {selectedComponent ? (
                          <>
                            <div className="wikelo-material-head">
                              <div>
                                <div className="detail-title">{selectedComponent.name}</div>
                                <div className="detail-subtitle">{selectedComponent.manufacturer || selectedComponent.categoryName}</div>
                              </div>
                              {selectedComponent.size ? <span className="trade-pill">{`S${selectedComponent.size}`}</span> : null}
                            </div>

                            <div className="mining-attribute-grid">
                              {selectedComponent.attributes
                                .filter((item) => normalizeAttribute(item))
                                .slice(0, 8)
                                .map((item) => (
                                  <div className="source-card" key={`${selectedComponent.id}-${item.attributeName}`}>
                                    <strong>{item.attributeName}</strong>
                                    <span>{normalizeAttribute(item)}</span>
                                  </div>
                                ))}
                            </div>

                            <div className="source-card">
                              <strong>Where to buy</strong>
                              {selectedComponent.offers?.length ? (
                                selectedComponent.offers.slice(0, 3).map((offer) => (
                                  <span key={`${selectedComponent.id}-${offer.id}`}>
                                    {formatMiningTerminal(offer.terminal)} · {Number(offer.priceBuy).toLocaleString("en-US")} aUEC
                                  </span>
                                ))
                              ) : (
                                <span>No live buy location found.</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="empty-text">Select a mining component to inspect it.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty-text">Select a mining ship to see a recommended setup.</p>
              )}
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="split-layout mining-workspace">
          <SectionCard title="Minerals" className="mining-column-card">
            <div className="mining-panel-scroll">
              <input
                className="app-input mono-input"
                value={mineralSearch}
                onChange={(event) => setMineralSearch(event.target.value)}
                placeholder="Search mineral..."
              />

              <div className="mining-mineral-list">
                {minerals.map((item) => (
                  <button
                    key={item.id}
                    className={`wikelo-shopping-row ${selectedMineralId === item.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedMineralId(item.id)}
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.intel?.tier || (item.isRaw ? "Raw material" : "Mineral")}</span>
                    </div>
                    <strong className="wikelo-ready">{item.intel?.miningType || "Ship"}</strong>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Where to mine" className="mining-column-card">
            <div className="mining-panel-scroll">
              {selectedMineral ? (
                <div className="mining-mineral-detail">
                  <div className="mining-mineral-hero">
                    <div className="wikelo-material-head">
                      <div>
                        <div className="detail-title">{selectedMineral.name}</div>
                        <div className="detail-subtitle">{selectedMineral.intel?.tier || "Mining commodity"}</div>
                      </div>
                      <div className="mining-ship-metrics">
                        <span>{selectedMineral.intel?.miningType || "Ship"}</span>
                        <span>{getMineralShipHint(selectedMineral)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mining-location-grid">
                    <div className="source-card mining-primary-destination">
                      <strong>Go here first</strong>
                      <span>{selectedMineral.intel?.bestSpot || selectedMineral.intel?.search?.[0] || "No best spot yet."}</span>
                    </div>

                    <div className="source-card">
                      <strong>Best places to search</strong>
                      {(selectedMineral.intel?.search ?? []).length ? (
                        <div className="mining-source-list">
                          {selectedMineral.intel.search.map((item) => (
                            <span key={item} className="trade-pill">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>No curated location hint yet.</span>
                      )}
                    </div>

                    <div className="source-card">
                      <strong>Best sell</strong>
                      {selectedMineral.bestSell ? (
                        <>
                          {selectedMineral.sellCommodityName && selectedMineral.sellCommodityName !== selectedMineral.name ? (
                            <span>{`Sell as ${selectedMineral.sellCommodityName}`}</span>
                          ) : null}
                          <span>{formatMiningTerminal(selectedMineral.bestSell.terminal)}</span>
                          <span>{Number(selectedMineral.bestSell.priceSell).toLocaleString("en-US")} aUEC / SCU</span>
                        </>
                      ) : (
                        <span>No live sell data found.</span>
                      )}
                    </div>
                  </div>

                  <div className="source-card">
                    <strong>Field note</strong>
                    <span>{selectedMineral.intel?.notes || "No local note yet for this mineral."}</span>
                  </div>

                  <div className="source-card">
                    <strong>Best sell locations</strong>
                    {selectedMineral.sellOffers?.length ? (
                      selectedMineral.sellOffers.slice(0, 4).map((offer) => (
                        <span key={`${selectedMineral.id}-${offer.id}`}>
                          {formatMiningTerminal(offer.terminal)} · {Number(offer.priceSell).toLocaleString("en-US")} aUEC / SCU
                        </span>
                      ))
                    ) : (
                      <span>No live sell location found.</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="empty-text">Select a mineral to see where to mine it.</p>
              )}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
