import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";

function formatTerminal(terminal) {
  if (!terminal) return "Unknown terminal";
  return [
    terminal.name || terminal.displayName || terminal.nickname || terminal.code,
    terminal.city,
    terminal.planet,
    terminal.moon,
    terminal.station,
    terminal.starSystem
  ]
    .filter(Boolean)
    .join(" / ");
}

function buildTopTradeRoutes(snapshot, limit = 5) {
  if (!snapshot?.prices?.length) return [];
  const terminals = new Map((snapshot.terminals ?? []).map((item) => [Number(item.id), item]));
  const grouped = new Map();

  for (const price of snapshot.prices ?? []) {
    const key = Number(price.commodityId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(price);
  }

  const routes = [];

  for (const entries of grouped.values()) {
    const bestBuy = entries
      .filter((item) => Number(item.priceBuy) > 0)
      .sort((left, right) => Number(left.priceBuy) - Number(right.priceBuy))[0];
    const bestSell = entries
      .filter((item) => Number(item.priceSell) > 0)
      .sort((left, right) => Number(right.priceSell) - Number(left.priceSell))[0];

    if (!bestBuy || !bestSell) continue;
    const profit = Number(bestSell.priceSell) - Number(bestBuy.priceBuy);
    if (!Number.isFinite(profit) || profit <= 0) continue;

    routes.push({
      commodity: bestSell.commodityName || bestBuy.commodityName || "Unknown",
      buyTerminal: terminals.get(Number(bestBuy.terminalId)),
      sellTerminal: terminals.get(Number(bestSell.terminalId)),
      buyPrice: Number(bestBuy.priceBuy),
      sellPrice: Number(bestSell.priceSell),
      profitPerScu: profit
    });
  }

  return routes.sort((left, right) => right.profitPerScu - left.profitPerScu).slice(0, limit);
}

function buildRouteHeatmap(snapshot, limit = 8) {
  if (!snapshot?.prices?.length) return [];
  const grouped = new Map();

  for (const price of snapshot.prices ?? []) {
    const key = Number(price.commodityId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(price);
  }

  const heat = [];

  for (const entries of grouped.values()) {
    const buys = entries.filter((item) => Number(item.priceBuy) > 0);
    const sells = entries.filter((item) => Number(item.priceSell) > 0);
    if (!buys.length || !sells.length) continue;

    const bestBuy = buys.sort((left, right) => Number(left.priceBuy) - Number(right.priceBuy))[0];
    const bestSell = sells.sort((left, right) => Number(right.priceSell) - Number(left.priceSell))[0];
    const profit = Number(bestSell.priceSell) - Number(bestBuy.priceBuy);
    if (!Number.isFinite(profit) || profit <= 0) continue;

    const buyStock = Number(bestBuy.scuBuy || bestBuy.scuBuyAvg || 0);
    const sellDemand = Number(bestSell.scuSell || bestSell.scuSellAvg || 0);
    const depth = Math.max(1, Math.min(buyStock || 0, sellDemand || 0));
    const routeCount = Math.max(1, buys.length * sells.length);
    const score = profit * depth + routeCount * 250;

    heat.push({
      commodity: bestSell.commodityName || bestBuy.commodityName || "Unknown",
      profitPerScu: profit,
      routes: routeCount,
      depth,
      score
    });
  }

  return heat.sort((left, right) => right.score - left.score).slice(0, limit);
}

function buildTopMinerals(snapshot, limit = 5) {
  if (!snapshot?.mineralPrices?.length) return [];
  const terminals = new Map((snapshot.terminals ?? []).map((item) => [Number(item.id), item]));
  const mineralMap = new Map((snapshot.minerals ?? []).map((item) => [Number(item.id), item]));
  const grouped = new Map();

  for (const price of snapshot.mineralPrices ?? []) {
    const key = Number(price.commodityId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(price);
  }

  const results = [];

  for (const [commodityId, entries] of grouped.entries()) {
    const bestSell = entries
      .filter((item) => Number(item.priceSell) > 0)
      .sort((left, right) => Number(right.priceSell) - Number(left.priceSell))[0];
    if (!bestSell) continue;

    const mineral = mineralMap.get(commodityId);
    results.push({
      name: mineral?.name || bestSell.commodityName || "Unknown",
      terminal: terminals.get(Number(bestSell.terminalId)),
      priceSell: Number(bestSell.priceSell)
    });
  }

  return results.sort((left, right) => right.priceSell - left.priceSell).slice(0, limit);
}

export default function HomePage({ onSyncAll, onNavigate }) {
  const [tradeSnapshot, setTradeSnapshot] = useState(null);
  const [miningSnapshot, setMiningSnapshot] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Local data ready");

  useEffect(() => {
    let mounted = true;
    async function loadSnapshots() {
      const trade = await window.desktopAPI.getTradeSnapshot();
      const mining = await window.desktopAPI.getMiningSnapshot();
      if (!mounted) return;
      setTradeSnapshot(trade?.ok ? trade.snapshot : null);
      setMiningSnapshot(mining?.ok ? mining.snapshot : null);
    }
    loadSnapshots();
    return () => {
      mounted = false;
    };
  }, []);

  const topRoutes = useMemo(() => buildTopTradeRoutes(tradeSnapshot), [tradeSnapshot]);
  const topMinerals = useMemo(() => buildTopMinerals(miningSnapshot), [miningSnapshot]);
  const heatmap = useMemo(() => buildRouteHeatmap(tradeSnapshot), [tradeSnapshot]);

  async function handleSyncAll() {
    if (!onSyncAll || syncing) return;
    setSyncing(true);
    setSyncMessage("Syncing all modules...");
    const result = await onSyncAll();
    setSyncing(false);
    if (!result?.ok) {
      setSyncMessage(result?.error || "Sync failed");
      return;
    }
    const trade = await window.desktopAPI.getTradeSnapshot();
    const mining = await window.desktopAPI.getMiningSnapshot();
    setTradeSnapshot(trade?.ok ? trade.snapshot : null);
    setMiningSnapshot(mining?.ok ? mining.snapshot : null);
    setSyncMessage("Synchronization complete");
  }

  return (
    <div className="page-shell home-page">
      <section className="scmdb-topbar">
        <div className="scmdb-topbar-title">
          <span className="scmdb-logo">HOME</span>
          <span className="scmdb-sep">//</span>
          <div>
            <strong>Command Center</strong>
            <span>Sync all sources and keep the best routes at a glance.</span>
          </div>
        </div>
      </section>

      <div className="three-column-layout home-layout">
        <SectionCard title="Sync center">
          <div className="home-panel-stack">
            <button className="primary-button" onClick={handleSyncAll} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync all data"}
            </button>
            <span className="home-sync-status">{syncMessage}</span>
            <div className="source-card">
              <strong>Trade snapshot</strong>
              <span>{tradeSnapshot?.fetchedAt ? new Date(tradeSnapshot.fetchedAt).toLocaleString("fr-FR") : "Not synced yet"}</span>
            </div>
            <div className="source-card">
              <strong>Mining snapshot</strong>
              <span>{miningSnapshot?.fetchedAt ? new Date(miningSnapshot.fetchedAt).toLocaleString("fr-FR") : "Not synced yet"}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Profit radar">
          <div className="home-panel-scroll">
            {topRoutes.length ? (
              topRoutes.map((route, index) => (
                <button
                  type="button"
                  className="home-radar-card"
                  key={`${route.commodity}-${index}`}
                  onClick={() => onNavigate?.("trade", { commodityName: route.commodity })}
                >
                  <div className="home-radar-head">
                    <strong>{route.commodity}</strong>
                    <span className="trade-pill safe">{`${route.profitPerScu.toLocaleString("en-US")} aUEC / SCU`}</span>
                  </div>
                  <span>Buy at {formatTerminal(route.buyTerminal)}</span>
                  <span>Sell at {formatTerminal(route.sellTerminal)}</span>
                </button>
              ))
            ) : (
              <div className="source-card">
                <strong>No trade snapshot</strong>
                <span>Run sync all to populate the radar.</span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Route heatmap">
          <div className="home-panel-scroll">
            {heatmap.length ? (
              heatmap.map((entry, index) => (
                <div className="home-heatmap-row" key={`${entry.commodity}-${index}`}>
                  <div className="home-heatmap-main">
                    <strong>{entry.commodity}</strong>
                    <span>{`${entry.profitPerScu.toLocaleString("en-US")} aUEC / SCU`}</span>
                  </div>
                  <div className="home-heatmap-bars">
                    <div className="home-heatmap-bar">
                      <span>Depth</span>
                      <div style={{ width: `${Math.min(100, entry.depth / 5)}%` }} />
                    </div>
                    <div className="home-heatmap-bar is-routes">
                      <span>Routes</span>
                      <div style={{ width: `${Math.min(100, entry.routes / 2)}%` }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="source-card">
                <strong>No trade snapshot</strong>
                <span>Run sync all to populate the heatmap.</span>
              </div>
            )}
            <p className="summary-copy compact">
              Heatmap is a proxy based on market depth and route count, not real traffic.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Top minerals">
          <div className="home-panel-scroll">
            {topMinerals.length ? (
              topMinerals.map((mineral, index) => (
                <button
                  type="button"
                  className="home-radar-card"
                  key={`${mineral.name}-${index}`}
                  onClick={() => onNavigate?.("mining", { mineralName: mineral.name })}
                >
                  <div className="home-radar-head">
                    <strong>{mineral.name}</strong>
                    <span className="trade-pill safe">{`${mineral.priceSell.toLocaleString("en-US")} aUEC / SCU`}</span>
                  </div>
                  <span>Best sell at {formatTerminal(mineral.terminal)}</span>
                </button>
              ))
            ) : (
              <div className="source-card">
                <strong>No mining snapshot</strong>
                <span>Run sync all to populate the radar.</span>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
