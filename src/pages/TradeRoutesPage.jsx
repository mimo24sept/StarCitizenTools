import { useState, useEffect, useMemo } from 'react';
import { toNumber, fmtMoney, fmtNumber } from '../utils/helpers';
import { TRADE_NODES, CARGO_SHIPS, COMBAT_SHIPS, LOADOUT_SLOTS } from '../utils/constants';
import SectionCard from '../components/SectionCard';
import Hero from '../components/Hero';
import TradeRouteMap from '../components/TradeRouteMap';
import { calculateBestRoutes, calculateCircularRoutes, diversifyRoutes, enrichRoutesWithDistanceMap, getCargoShips, getDistancePairKey, getSystems, getTerminalLabel, getTradeCommodities, getTradeTerminals, loadTradeSnapshot, sortTradeRoutes } from '../tradeData';

export default function TradeRoutesPage({ visual }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [ships, setShips] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [systems, setSystems] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [results, setResults] = useState([]);
  const [distanceMap, setDistanceMap] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [preferredDraft, setPreferredDraft] = useState("");
  const [avoidDraft, setAvoidDraft] = useState("");
  const [overlayState, setOverlayState] = useState({ visible: false, progressIndex: 0, route: null });
  const [form, setForm] = useState({
    routeMode: "single",
    loopLegCount: 3,
    shipId: "",
    cargoCapacity: 0,
    budget: 500000,
    originTerminalId: "",
    destinationSystem: "",
    legalityFilter: "all",
    sortBy: "profit",
    includeCommodityIds: [],
    excludeCommodityIds: []
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const data = await loadTradeSnapshot();
      if (!mounted) return;
      setSnapshot(data);
      setLoading(false);
      setError(data ? "" : "No local trade snapshot yet. Run a sync first.");
    }
    load();
    window.desktopAPI.getOverlayState().then((state) => {
      if (mounted) setOverlayState(state);
    });
    const unsubscribe = window.desktopAPI.onOverlayState((state) => {
      if (mounted) setOverlayState(state);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      setShips([]);
      setTerminals([]);
      setSystems([]);
      setCommodities([]);
      return;
    }
    const nextShips = getCargoShips(snapshot);
    const nextTerminals = getTradeTerminals(snapshot);
    const nextSystems = getSystems(snapshot);
    const nextCommodities = getTradeCommodities(snapshot);
    setDistanceMap({});
    setShips(nextShips);
    setTerminals(nextTerminals);
    setSystems(nextSystems);
    setCommodities(nextCommodities);
    setForm((current) => {
      const selectedShip = nextShips.find((item) => (item.fullName || item.name) === current.shipId) ?? nextShips[0];
      const selectedTerminal = nextTerminals.find((item) => String(item.id) === String(current.originTerminalId));
      return {
        ...current,
        shipId: selectedShip ? selectedShip.fullName || selectedShip.name : "",
        cargoCapacity: current.cargoCapacity || selectedShip?.scu || 0,
        originTerminalId: selectedTerminal ? String(selectedTerminal.id) : current.originTerminalId || "",
        includeCommodityIds: current.includeCommodityIds.filter((id) => nextCommodities.some((item) => item.id === id)),
        excludeCommodityIds: current.excludeCommodityIds.filter((id) => nextCommodities.some((item) => item.id === id))
      };
    });
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) {
      setResults([]);
      return;
    }
    const routeOptions = {
      cargoCapacity: form.cargoCapacity,
      budget: form.budget,
      originTerminalId: form.originTerminalId,
      destinationSystem: form.destinationSystem,
      legalityFilter: form.legalityFilter,
      sortBy: form.sortBy,
      loopLegCount: form.loopLegCount,
      includeCommodityIds: form.includeCommodityIds,
      excludeCommodityIds: form.excludeCommodityIds
    };
    const nextResults = form.routeMode === "circular"
      ? calculateCircularRoutes(snapshot, routeOptions)
      : calculateBestRoutes(snapshot, routeOptions);
    setResults(nextResults);
    setSelectedIndex(0);
  }, [snapshot, form]);

  const enrichedResults = useMemo(
    () => sortTradeRoutes(enrichRoutesWithDistanceMap(results, snapshot, distanceMap), form.sortBy),
    [results, snapshot, distanceMap, form.sortBy]
  );

  useEffect(() => {
    if (!snapshot || !results.length) return;

    const candidateRoutes = (form.routeMode === "circular" ? results : diversifyRoutes(results, 2, 24)).slice(0, form.routeMode === "circular" ? 10 : 18);
    const pairs = [];
    const seen = new Set();

    for (const route of candidateRoutes) {
      const legs = route.mode === "circular" ? route.legs : [route];
      for (const leg of legs) {
        const key = getDistancePairKey(leg.originTerminalId, leg.destinationTerminalId);
        if (!key || seen.has(key) || key in distanceMap) continue;
        seen.add(key);
        pairs.push({
          originTerminalId: leg.originTerminalId,
          destinationTerminalId: leg.destinationTerminalId
        });
      }
    }

    if (!pairs.length) return;

    let cancelled = false;
    window.desktopAPI.resolveTradeDistances(pairs).then((response) => {
      if (cancelled || !response?.ok || !response.distances) return;
      setDistanceMap((current) => ({ ...current, ...response.distances }));
    });

    return () => {
      cancelled = true;
    };
  }, [snapshot, results, form.routeMode, distanceMap]);

  useEffect(() => {
    const selectedShip = ships.find((item) => (item.fullName || item.name) === form.shipId);
    if (!selectedShip) return;
    if (Number(form.cargoCapacity) === Number(selectedShip.scu)) return;
    setForm((current) => ({ ...current, cargoCapacity: selectedShip.scu }));
  }, [form.shipId, ships]);

  async function runTradeSync() {
    setSyncing(true);
    const result = await window.desktopAPI.runTradeSync();
    setSyncing(false);
    if (!result.ok) {
      setError(result.error || "Trade sync failed");
      return;
    }
    const data = await loadTradeSnapshot();
    setSnapshot(data);
    setError("");
  }

  function resolveCommodityId(name) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return null;
    return commodities.find((item) => item.name.toLowerCase() === normalized)?.id ?? null;
  }

  function addCommodityFilter(kind) {
    const draft = kind === "includeCommodityIds" ? preferredDraft : avoidDraft;
    const commodityId = resolveCommodityId(draft);
    if (!commodityId) return;
    setForm((current) => {
      const nextValues = current[kind].includes(commodityId) ? current[kind] : [...current[kind], commodityId];
      const oppositeKind = kind === "includeCommodityIds" ? "excludeCommodityIds" : "includeCommodityIds";
      return {
        ...current,
        [kind]: nextValues,
        [oppositeKind]: current[oppositeKind].filter((id) => id !== commodityId)
      };
    });
    if (kind === "includeCommodityIds") setPreferredDraft("");
    else setAvoidDraft("");
  }

  function removeCommodityFilter(kind, commodityId) {
    setForm((current) => ({
      ...current,
      [kind]: current[kind].filter((id) => id !== commodityId)
    }));
  }

  function getCommodityName(id) {
    return commodities.find((item) => item.id === id)?.name ?? `Commodity ${id}`;
  }

  function buildOverlayRoute(route) {
    if (!route) return null;
    if (route.mode === "circular") {
      return {
        title: "Circular route",
        meta: [
          `${route.legs.length} legs`,
          fmtMoney(route.profit),
          route.isIllegal ? "Illegal" : "Legal"
        ],
        steps: route.legs.flatMap((leg, index) => ([
          {
            title: `Leg ${index + 1} · Buy ${leg.commodityName}`,
            subtitle: leg.originRegion,
            meta: `${fmtMoney(leg.buyPrice)} / SCU`
          },
          {
            title: `Leg ${index + 1} · Sell at ${leg.destinationName}`,
            subtitle: leg.destinationRegion,
            meta: `${fmtMoney(leg.sellPrice)} / SCU`
          }
        ]))
      };
    }
    return {
      title: route.commodityName,
      meta: [
        `${route.quantity} SCU`,
        fmtMoney(route.profit),
        route.isIllegal ? "Illegal" : "Legal"
      ],
      steps: [
        {
          title: `Buy at ${route.originName}`,
          subtitle: route.originRegion,
          meta: `${fmtMoney(route.buyPrice)} / SCU`
        },
        {
          title: `Travel to ${route.destinationName}`,
          subtitle: route.destinationRegion,
          meta: `${route.quantity} SCU onboard`
        },
        {
          title: `Sell at ${route.destinationName}`,
          subtitle: route.destinationRegion,
          meta: `${fmtMoney(route.sellPrice)} / SCU`
        }
      ]
    };
  }

  async function showSelectedRouteInOverlay() {
    if (!visibleSelectedRoute) return;
    const state = await window.desktopAPI.showOverlay(buildOverlayRoute(visibleSelectedRoute));
    setOverlayState(state);
  }

  async function hideOverlay() {
    const state = await window.desktopAPI.hideOverlay();
    setOverlayState(state);
  }

  async function resetOverlayProgress() {
    const state = await window.desktopAPI.resetOverlayProgress();
    setOverlayState(state);
  }

  const visibleResults = form.routeMode === "circular" ? enrichedResults.slice(0, 24) : diversifyRoutes(enrichedResults, 2, 24);
  const visibleSelectedRoute = visibleResults[selectedIndex] ?? null;

  useEffect(() => {
    if (selectedIndex < visibleResults.length) return;
    setSelectedIndex(0);
  }, [selectedIndex, visibleResults.length]);

  useEffect(() => {
    if (visibleSelectedRoute) return;
    setMapExpanded(false);
  }, [visibleSelectedRoute]);

  if (mapExpanded && visibleSelectedRoute) {
    return (
      <div className="page-shell trade-page">
        <section className="trade-map-screen">
          <div className="trade-map-screen-head">
            <button className="ghost-button" onClick={() => setMapExpanded(false)}>Back to trade routes</button>
            <div className="trade-map-screen-copy">
              <strong>{visibleSelectedRoute.commodityName}</strong>
              <span>{visibleSelectedRoute.originName} {"->"} {visibleSelectedRoute.destinationName}</span>
            </div>
          </div>
          <TradeRouteMap route={visibleSelectedRoute} expanded />
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell trade-page">
      <div className="three-column-layout trade-layout">
        <SectionCard title="Trade calculator" className="narrow-card trade-control-card">
          <div className="trade-inline-stats">
            <span>{enrichedResults.length} routes</span>
            <span>Best {fmtMoney(enrichedResults[0]?.profit ?? 0)}</span>
            <span>{form.routeMode === "circular" ? `${visibleResults[0]?.legs?.length ?? 0} leg loop` : visibleResults[0]?.commodityName ?? "-"}</span>
          </div>
          <div className="trade-form-grid">
            <label className="field-stack">
              <span>Route mode</span>
              <select className="app-select" value={form.routeMode} onChange={(event) => setForm((current) => ({ ...current, routeMode: event.target.value }))}>
                <option value="single">Simple route</option>
                <option value="circular">Circular route</option>
              </select>
            </label>

            {form.routeMode === "circular" ? (
              <label className="field-stack">
                <span>Loop legs</span>
                <select className="app-select" value={form.loopLegCount} onChange={(event) => setForm((current) => ({ ...current, loopLegCount: toNumber(event.target.value, current.loopLegCount) }))}>
                  <option value="3">3 legs</option>
                  <option value="4">4 legs</option>
                  <option value="5">5 legs</option>
                </select>
              </label>
            ) : null}

            <label className="field-stack">
              <span>Ship</span>
              <input
                className="app-input"
                list="trade-ship-options"
                value={form.shipId}
                onChange={(event) => setForm((current) => ({ ...current, shipId: event.target.value }))}
                placeholder="Type a ship name"
              />
              <datalist id="trade-ship-options">
                {ships.map((item) => {
                  const label = item.fullName || item.name;
                  return <option key={label} value={label} />;
                })}
              </datalist>
            </label>

            <label className="field-stack">
              <span>Cargo capacity</span>
              <input className="app-input" type="number" min="1" value={form.cargoCapacity} onChange={(event) => setForm((current) => ({ ...current, cargoCapacity: Math.max(1, toNumber(event.target.value, current.cargoCapacity)) }))} />
            </label>

            <label className="field-stack">
              <span>Budget</span>
              <input className="app-input" type="number" min="0" value={form.budget} onChange={(event) => setForm((current) => ({ ...current, budget: Math.max(0, toNumber(event.target.value, current.budget)) }))} />
            </label>

            <label className="field-stack">
              <span>Origin terminal</span>
              <select className="app-select" value={form.originTerminalId} onChange={(event) => setForm((current) => ({ ...current, originTerminalId: event.target.value }))}>
                <option value="">Any terminal</option>
                {terminals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getTerminalLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span>Destination system</span>
              <select className="app-select" value={form.destinationSystem} onChange={(event) => setForm((current) => ({ ...current, destinationSystem: event.target.value }))}>
                <option value="">All systems</option>
                {systems.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-stack">
              <span>Legality</span>
              <select className="app-select" value={form.legalityFilter} onChange={(event) => setForm((current) => ({ ...current, legalityFilter: event.target.value }))}>
                <option value="all">All commodities</option>
                <option value="legal">Legal only</option>
                <option value="illegal">Illegal only</option>
              </select>
            </label>

            <label className="field-stack">
              <span>Sort routes by</span>
              <select className="app-select" value={form.sortBy} onChange={(event) => setForm((current) => ({ ...current, sortBy: event.target.value }))}>
                <option value="profit">Total profit</option>
                <option value="efficiency">Profit / min</option>
                <option value="time">Fastest</option>
                <option value="margin">Margin %</option>
                <option value="unit">Profit / SCU</option>
              </select>
            </label>
          </div>

          <div className="trade-filter-block">
            <div className="trade-chip-editor">
              <label className="field-stack">
                <span>Preferred commodities</span>
                <div className="trade-chip-input-row">
                  <input
                    className="app-input"
                    list="trade-commodity-options"
                    value={preferredDraft}
                    onChange={(event) => setPreferredDraft(event.target.value)}
                    placeholder="Type a commodity to prefer"
                  />
                  <button className="secondary-button" type="button" onClick={() => addCommodityFilter("includeCommodityIds")}>Add</button>
                </div>
              </label>
              <div className="trade-chip-list">
                {form.includeCommodityIds.length ? form.includeCommodityIds.map((id) => (
                  <button key={`include-${id}`} type="button" className="trade-filter-chip is-preferred" onClick={() => removeCommodityFilter("includeCommodityIds", id)}>
                    <span>{getCommodityName(id)}</span>
                    <strong>x</strong>
                  </button>
                )) : <span className="trade-chip-placeholder">No preferred commodity selected</span>}
              </div>
            </div>

            <div className="trade-chip-editor">
              <label className="field-stack">
                <span>Avoid commodities</span>
                <div className="trade-chip-input-row">
                  <input
                    className="app-input"
                    list="trade-commodity-options"
                    value={avoidDraft}
                    onChange={(event) => setAvoidDraft(event.target.value)}
                    placeholder="Type a commodity to avoid"
                  />
                  <button className="ghost-button" type="button" onClick={() => addCommodityFilter("excludeCommodityIds")}>Avoid</button>
                </div>
              </label>
              <div className="trade-chip-list">
                {form.excludeCommodityIds.length ? form.excludeCommodityIds.map((id) => (
                  <button key={`exclude-${id}`} type="button" className="trade-filter-chip is-avoid" onClick={() => removeCommodityFilter("excludeCommodityIds", id)}>
                    <span>{getCommodityName(id)}</span>
                    <strong>x</strong>
                  </button>
                )) : <span className="trade-chip-placeholder">No excluded commodity selected</span>}
              </div>
            </div>
            <datalist id="trade-commodity-options">
              {commodities.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
          </div>

          <div className="button-row trade-actions">
            <button className="primary-button" onClick={runTradeSync} disabled={syncing}>
              {syncing ? "Syncing trade..." : "Sync trade data"}
            </button>
            {snapshot ? <span className="summary-copy compact">Snapshot {snapshot.fetchedAt}</span> : null}
          </div>
          {error ? <p className="empty-text">{error}</p> : null}
          <p className="summary-copy compact">Source: UEX public vehicles, terminals, commodities and commodity prices.</p>
        </SectionCard>

        <SectionCard title="Best routes" className="trade-results-card">
          {loading ? <p className="empty-text">Loading local trade snapshot...</p> : null}
          {!loading && !enrichedResults.length ? <p className="empty-text">No profitable {form.routeMode === "circular" ? "loop" : "route"} found for the current budget, ship and origin.</p> : null}
          {!!enrichedResults.length ? (
            <div className="trade-results">
              {visibleResults.map((item, index) => (
                <button key={`${item.mode || "single"}-${item.originTerminalId}-${item.destinationTerminalId}-${index}`} className={`trade-route-card ${selectedIndex === index ? "is-selected" : ""}`} onClick={() => setSelectedIndex(index)}>
                  <div className="trade-route-head">
                    <strong>{item.mode === "circular" ? "Circular loop" : item.commodityName}</strong>
                    <span className={`trade-pill ${item.isIllegal ? "danger" : "safe"}`}>{item.mode === "circular" ? "Loop" : item.isIllegal ? "Illegal" : "Legal"}</span>
                  </div>
                  {item.mode === "circular" ? (
                    <>
                      <div className="trade-route-path">
                        {[item.legs[0]?.originName, ...item.legs.map((leg) => leg.destinationName)].map((step, stepIndex, allSteps) => (
                          <div key={`loop-path-${index}-${stepIndex}`} className="trade-path-step">
                            <span className="trade-leg">{step}</span>
                            {stepIndex < allSteps.length - 1 ? <span className="trade-arrow">-&gt;</span> : null}
                          </div>
                        ))}
                      </div>
                      <div className="trade-route-locations trade-loop-lines">
                        {item.legs.map((leg, legIndex) => (
                          <span key={`loop-${index}-${legIndex}`}>Leg {legIndex + 1}: {leg.commodityName} · {leg.originName} -&gt; {leg.destinationName}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="trade-route-path">
                        <span className="trade-leg">{item.originName}</span>
                        <span className="trade-arrow">-&gt;</span>
                        <span className="trade-leg">{item.destinationName}</span>
                      </div>
                      <div className="trade-route-locations">
                        <span>{item.originRegion}</span>
                        <span>{item.destinationRegion}</span>
                      </div>
                    </>
                  )}
                  <div className="trade-route-metrics">
                    <div className="trade-metric-block">
                      <small>Total profit</small>
                      <strong>{fmtMoney(item.profit)}</strong>
                    </div>
                    <div className="trade-metric-block">
                      <small>{item.mode === "circular" ? "Loop size" : "Cargo fill"}</small>
                      <strong>{item.mode === "circular" ? `${item.legs.length} legs` : `${item.quantity} SCU`}</strong>
                    </div>
                    <div className="trade-metric-block">
                      <small>{item.mode === "circular" ? "Profit / min" : "Profit / SCU"}</small>
                      <strong>{fmtMoney(item.mode === "circular" ? item.profitPerMinute : item.unitProfit)}</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Selected route" className="narrow-card trade-detail-card">
          {visibleSelectedRoute ? (
            <div className="text-panel trade-selected">
              <strong className="trade-selected-title">{visibleSelectedRoute.mode === "circular" ? "Circular loop" : visibleSelectedRoute.commodityName}</strong>
              {visibleSelectedRoute.mode === "circular" ? (
                <>
                  <div className="trade-selected-path">
                    <span>{visibleSelectedRoute.loopLabel}</span>
                  </div>
                  <div className="trade-selected-locations trade-loop-detail">
                    {visibleSelectedRoute.legs.map((leg, index) => (
                      <div className="route-step" key={`selected-loop-${index}`}>
                        <strong>Leg {index + 1}</strong>
                        <span>{leg.commodityName}</span>
                        <span>{leg.originName} -&gt; {leg.destinationName}</span>
                        <span>{fmtMoney(leg.profit)} · {Math.round(leg.estimatedMinutes || 0)} min</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="trade-selected-path">
                    <span>{visibleSelectedRoute.originName}</span>
                    <span className="trade-arrow">-&gt;</span>
                    <span>{visibleSelectedRoute.destinationName}</span>
                  </div>
                  <div className="trade-selected-locations">
                    <div className="route-step">
                      <strong>Buy at</strong>
                      <span>{visibleSelectedRoute.originRegion}</span>
                    </div>
                    <div className="route-step">
                      <strong>Sell at</strong>
                      <span>{visibleSelectedRoute.destinationRegion}</span>
                    </div>
                  </div>
                </>
              )}
              <div className="trade-stat-grid">
                {visibleSelectedRoute.mode === "circular" ? (
                  <>
                    <div className="source-card">
                      <strong>Starting funds</strong>
                      <span>{fmtMoney(form.budget)}</span>
                    </div>
                    <div className="source-card">
                      <strong>Ending funds</strong>
                      <span>{fmtMoney(visibleSelectedRoute.endingFunds)}</span>
                    </div>
                    <div className="source-card">
                      <strong>Profit / min</strong>
                      <span>{fmtMoney(visibleSelectedRoute.profitPerMinute)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="source-card">
                      <strong>Buy price</strong>
                      <span>{fmtMoney(visibleSelectedRoute.buyPrice)}</span>
                    </div>
                    <div className="source-card">
                      <strong>Sell price</strong>
                      <span>{fmtMoney(visibleSelectedRoute.sellPrice)}</span>
                    </div>
                    <div className="source-card">
                      <strong>Profit / SCU</strong>
                      <span>{fmtMoney(visibleSelectedRoute.unitProfit)}</span>
                    </div>
                  </>
                )}
                <div className="source-card">
                  <strong>Total profit</strong>
                  <span>{fmtMoney(visibleSelectedRoute.profit)}</span>
                </div>
                <div className="source-card">
                  <strong>{visibleSelectedRoute.mode === "circular" ? "Estimated duration" : "Investment"}</strong>
                  <span>{visibleSelectedRoute.mode === "circular" ? `${Math.round(visibleSelectedRoute.estimatedMinutes || 0)} min` : fmtMoney(visibleSelectedRoute.investment)}</span>
                </div>
                <div className="source-card">
                  <strong>Margin</strong>
                  <span>{visibleSelectedRoute.marginPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="button-row trade-overlay-actions">
                <button className="secondary-button" onClick={() => setMapExpanded(true)}>
                  Open map
                </button>
                <button className="primary-button" onClick={showSelectedRouteInOverlay}>
                  {overlayState.visible ? "Update overlay" : "Show overlay"}
                </button>
                <button className="secondary-button" onClick={resetOverlayProgress} disabled={!overlayState.route}>
                  Reset overlay
                </button>
                <button className="ghost-button" onClick={hideOverlay} disabled={!overlayState.visible}>
                  Hide overlay
                </button>
              </div>
              <p className="summary-copy compact">
                Overlay {overlayState.visible ? "visible" : "hidden"}{overlayState.route ? ` · step ${overlayState.progressIndex + 1}` : ""}
              </p>
              <div className="trade-estimate-card">
                <div className="trade-estimate-title">{visibleSelectedRoute.mode === "circular" ? "Loop capacity floor" : "Estimated fill"}</div>
                <div className="trade-estimate-value">{visibleSelectedRoute.quantity} SCU</div>
                <div className="trade-estimate-meta">
                  {visibleSelectedRoute.mode === "circular"
                    ? `${visibleSelectedRoute.commodityCount} commodity types / ${visibleSelectedRoute.legs.length} trade legs / ${Math.round(visibleSelectedRoute.estimatedMinutes || 0)} min`
                    : `Buy stock ${fmtNumber(visibleSelectedRoute.availabilityScu)} / destination demand ${fmtNumber(visibleSelectedRoute.destinationDemandScu)} / ${Math.round(visibleSelectedRoute.estimatedMinutes || 0)} min`}
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-text">Select a route to inspect the full calculation.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
