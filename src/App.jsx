import { useEffect, useState } from 'react';
import { createDbClient } from './dbClient';
import { PAGE_VISUALS } from './utils/constants';
import AppState from './components/AppState';
import CraftingPage from './pages/CraftingPage';
import HomePage from './pages/HomePage';
import ItemFinderPage from './pages/ItemFinderPage';
import MiningPage from './pages/MiningPage';
import TradeRoutesPage from './pages/TradeRoutesPage';
import WikeloPage from './pages/WikeloPage';

function randomVisual(page) {
  const set = PAGE_VISUALS[page] ?? [];
  return set[Math.floor(Math.random() * set.length)] ?? { kicker: "", title: "", subtitle: "" };
}

export default function App() {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState("");
  const [activePage, setActivePage] = useState("home");
  const [stickyNotes, setStickyNotes] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Local data ready");
  const [homeSelection, setHomeSelection] = useState({ tradeCommodityName: "", mineralName: "" });
  const [visuals] = useState({
    crafting: randomVisual("crafting"),
    home: randomVisual("home"),
    trade: randomVisual("trade"),
    mining: randomVisual("mining"),
    itemfinder: randomVisual("itemfinder"),
    wikelo: randomVisual("wikelo")
  });

  useEffect(() => {
    let mounted = true;
    const savedPage = window.localStorage.getItem("scc.activePage");
    const savedNotes = window.localStorage.getItem("scc.stickyNotes");
    if (savedPage) {
      setActivePage(savedPage);
    }
    if (savedNotes) {
      setStickyNotes(savedNotes);
    }
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

  useEffect(() => {
    window.localStorage.setItem("scc.activePage", activePage);
  }, [activePage]);

  useEffect(() => {
    window.localStorage.setItem("scc.stickyNotes", stickyNotes);
  }, [stickyNotes]);

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
    return { ok: true };
  }

  async function runSyncAll() {
    if (syncing) {
      return { ok: false, error: "Sync already running" };
    }

    setSyncing(true);
    setSyncMessage("Synchronizing all sources...");

    const craftResult = await window.desktopAPI.runSync();
    if (!craftResult.ok) {
      setSyncing(false);
      setSyncMessage("Synchronization failed");
      return { ok: false, error: craftResult.stderr || "Crafting sync failed" };
    }

    await db.reloadFromDisk();
    const loadedVersions = db.getVersions();
    setVersions(loadedVersions);
    setVersion(db.getDefaultVersion());
    triggerRefresh();

    const [tradeResult, miningResult, wikeloResult, itemFinderResult] = await Promise.all([
      window.desktopAPI.runTradeSync(),
      window.desktopAPI.runMiningSync(),
      window.desktopAPI.runWikeloSync(),
      window.desktopAPI.runItemFinderSync()
    ]);

    setSyncing(false);
    setSyncMessage("Synchronization complete");

    const failures = [
      tradeResult?.ok ? null : "Trade",
      miningResult?.ok ? null : "Mining",
      wikeloResult?.ok ? null : "Wikelo",
      itemFinderResult?.ok ? null : "Item Finder"
    ].filter(Boolean);

    if (failures.length) {
      return { ok: false, error: `Failed: ${failures.join(", ")}` };
    }

    return { ok: true };
  }

  function handleHomeNavigate(target, payload = {}) {
    if (target === "trade") {
      setHomeSelection((current) => ({
        ...current,
        tradeCommodityName: payload.commodityName || ""
      }));
    }
    if (target === "mining") {
      setHomeSelection((current) => ({
        ...current,
        mineralName: payload.mineralName || ""
      }));
    }
    setActivePage(target);
  }

  if (loading) return <AppState title="Loading local database" subtitle="Preparing the new desktop shell..." />;
  if (error || !db) return <AppState title="Unable to start the app" subtitle={error || "Unknown initialization error"} />;

  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <h1>Star Citizen Companion</h1>
            </div>
            <div className="sidebar-ledger">
              <span className="ledger-pill is-live">LIVE</span>
              <span className="ledger-pill">{version}</span>
            </div>
          </div>

          <div className="sidebar-group-label">Modules</div>
          <nav className="nav-list">
            {[
              ["home", "Home"],
              ["crafting", "Crafting"],
              ["mining", "Mining"],
              ["itemfinder", "Item Finder"],
              ["trade", "Trade Routes"],
              ["wikelo", "Wikelo"]
            ].map(([key, label], index) => (
              <button
                key={key}
                className={`nav-button ${activePage === key ? "is-active" : ""}`}
                onClick={() => setActivePage(key)}
              >
                <span className="nav-button-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="nav-button-copy">
                  <strong>{label}</strong>
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-notes">
            <div className="sidebar-group-label">Notes</div>
            <textarea
              className="app-input sidebar-notes-input"
              value={stickyNotes}
              onChange={(event) => setStickyNotes(event.target.value)}
              placeholder="Sticky notes..."
              rows={6}
            />
          </div>
        </aside>

        <main className="content">
          <div className="content-frame">
            {activePage === "crafting" && (
              <CraftingPage
                db={db}
                version={version}
                versions={versions}
                syncing={syncing}
                syncMessage={syncMessage}
                onVersionChange={setVersion}
                onSync={runSync}
                refreshToken={refreshToken}
                visual={visuals.crafting}
                onMutate={triggerRefresh}
              />
            )}
            {activePage === "home" && <HomePage onSyncAll={runSyncAll} onNavigate={handleHomeNavigate} />}
            {activePage === "itemfinder" && <ItemFinderPage visual={visuals.itemfinder} />}
            {activePage === "mining" && <MiningPage visual={visuals.mining} prefillMineralName={homeSelection.mineralName} />}
            {activePage === "trade" && <TradeRoutesPage visual={visuals.trade} prefillCommodityName={homeSelection.tradeCommodityName} />}
            {activePage === "wikelo" && <WikeloPage db={db} version={version} refreshToken={refreshToken} visual={visuals.wikelo} onMutate={triggerRefresh} />}
          </div>
        </main>
      </div>
    </div>
  );
}
