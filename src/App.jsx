import { useDeferredValue, useEffect, useState } from 'react';
import { createDbClient } from './dbClient';
import { PAGE_VISUALS } from './utils/constants';
import { fmtSeconds, toNumber, getIngredientQualityKey } from './utils/helpers';
import SectionCard from './components/SectionCard';
import Hero from './components/Hero';
import TradePage from './pages/TradePage';
import TradeRoutesPage from './pages/TradeRoutesPage';
import LoadoutsPage from './pages/LoadoutsPage';
import WikeloPage from './pages/WikeloPage';

export default function App() {
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

          <div className="sidebar-card sidebar-sync-card">
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

          <div className="sidebar-group-label">Modules</div>
          <nav className="nav-list">
            {[
              ["crafting", "Crafting"],
              ["trade", "Trade Routes"],
              ["loadouts", "Loadouts"],
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
        </aside>

        <main className="content">
          <div className="content-frame">
            {activePage === "crafting" && <CraftingPage db={db} version={version} refreshToken={refreshToken} visual={visuals.crafting} onMutate={triggerRefresh} />}
            {activePage === "trade" && <TradeRoutesPage visual={visuals.trade} />}
            {activePage === "loadouts" && <LoadoutsPage db={db} refreshToken={refreshToken} visual={visuals.loadouts} onMutate={triggerRefresh} />}
            {activePage === "wikelo" && <WikeloPage db={db} version={version} refreshToken={refreshToken} visual={visuals.wikelo} onMutate={triggerRefresh} />}
          </div>
        </main>
      </div>
    </div>
  );
}
