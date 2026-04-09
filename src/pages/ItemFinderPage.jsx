import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import {
  enrichItemFinderItem,
  formatItemFinderTerminal,
  getItemFinderCategories,
  getItemFinderItems,
  getItemFinderManufacturers,
  getItemFinderSections,
  loadItemFinderSnapshot
} from "../itemFinderData";

export default function ItemFinderPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [category, setCategory] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [size, setSize] = useState("");
  const [liveBuyOnly, setLiveBuyOnly] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const data = await loadItemFinderSnapshot();
      if (!mounted) return;
      setSnapshot(data);
      setLoading(false);
      setError(data ? "" : "No item snapshot yet. Run a sync first.");
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function runItemFinderSync() {
    setSyncing(true);
    const result = await window.desktopAPI.runItemFinderSync();
    setSyncing(false);
    if (!result?.ok) {
      setError(result?.error || "Item sync failed");
      return;
    }
    const data = await loadItemFinderSnapshot();
    setSnapshot(data);
    setError("");
  }

  const sections = useMemo(() => getItemFinderSections(snapshot), [snapshot]);
  const categories = useMemo(() => getItemFinderCategories(snapshot), [snapshot]);
  const manufacturers = useMemo(() => getItemFinderManufacturers(snapshot), [snapshot]);

  const items = useMemo(
    () =>
      getItemFinderItems(snapshot, {
        search,
        section,
        category,
        manufacturer,
        size,
        liveBuyOnly
      }),
    [snapshot, search, section, category, manufacturer, size, liveBuyOnly]
  );

  useEffect(() => {
    if (!items.length) {
      setSelectedItemId(0);
      return;
    }
    if (!items.some((item) => Number(item.id) === Number(selectedItemId))) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const selectedItem = useMemo(
    () => enrichItemFinderItem(items.find((item) => Number(item.id) === Number(selectedItemId)) ?? null, snapshot),
    [items, selectedItemId, snapshot]
  );

  if (loading) {
    return (
      <div className="state-shell">
        <div className="state-card">
          <h1>Loading item finder</h1>
          <p>Preparing UEX items, categories and shop data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell itemfinder-page">
      <section className="scmdb-topbar">
        <div className="scmdb-topbar-title">
          <span className="scmdb-logo">UEX</span>
          <span className="scmdb-sep">//</span>
          <div>
            <strong>Universal Item Finder</strong>
            <span>Search an item and see where to buy it right now.</span>
          </div>
        </div>
        <div className="scmdb-topbar-actions">
          <span className="trade-pill">{`${items.length} items`}</span>
          <button className="primary-button small" onClick={runItemFinderSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync item data"}
          </button>
        </div>
      </section>

      {!snapshot ? (
        <div className="state-shell">
          <div className="state-card">
            <h1>No item snapshot</h1>
            <p>{error || "Run an item sync to populate the finder."}</p>
            <div className="button-row">
              <button className="primary-button" onClick={runItemFinderSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync item data"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="split-layout even itemfinder-layout">
          <SectionCard title="Filters">
            <div className="itemfinder-panel-scroll">
              <div className="itemfinder-form-grid">
                <input
                  className="app-input mono-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search item..."
                />
                <select className="app-select" value={section} onChange={(event) => setSection(event.target.value)}>
                  <option value="">Any section</option>
                  {sections.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select className="app-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">Any category</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select className="app-select" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}>
                  <option value="">Any maker</option>
                  {manufacturers.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  className="app-input mono-input"
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  placeholder="Any size"
                />
                <button
                  className={`filter-toggle ${liveBuyOnly ? "is-active" : ""}`}
                  onClick={() => setLiveBuyOnly((value) => !value)}
                >
                  {liveBuyOnly ? "Live buy only" : "Show all items"}
                </button>
              </div>

              <div className="source-card itemfinder-summary-card">
                <strong>Snapshot</strong>
                <span>{snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("fr-FR") : "Unknown sync time"}</span>
                <span>{`${snapshot.items?.length ?? 0} synced items / ${snapshot.prices?.length ?? 0} price entries`}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Results">
            <div className="itemfinder-panel-scroll itemfinder-results-list">
              {items.length ? (
                items.map((item) => {
                  const enriched = enrichItemFinderItem(item, snapshot);
                  return (
                    <button
                      key={item.id}
                      className={`wikelo-recipe-card ${selectedItemId === item.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <div className="wikelo-recipe-card-head">
                        <strong>{item.name}</strong>
                        <div className="wikelo-recipe-card-badges">
                          {item.size ? <span className="trade-pill">{`S${item.size}`}</span> : null}
                          {enriched?.bestBuy ? (
                            <span className="trade-pill safe">{`${Number(enriched.bestBuy.priceBuy).toLocaleString("en-US")} aUEC`}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="wikelo-recipe-card-meta">
                        <span>{item.manufacturer || "Unknown maker"}</span>
                        <span>{item.categoryName}</span>
                      </div>
                      {enriched?.bestBuy ? (
                        <div className="wikelo-recipe-card-stats">
                          <span>{formatItemFinderTerminal(enriched.bestBuy.terminal)}</span>
                        </div>
                      ) : (
                        <div className="wikelo-recipe-card-stats">
                          <span>No live buy data</span>
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="source-card">
                  <strong>No match</strong>
                  <span>Try another search or widen the filters.</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Item detail">
            <div className="itemfinder-panel-scroll">
              {selectedItem ? (
                <div className="itemfinder-detail-stack">
                  <div className="wikelo-material-head">
                    <div>
                      <div className="detail-title">{selectedItem.name}</div>
                      <div className="detail-subtitle">{selectedItem.manufacturer || selectedItem.categoryName}</div>
                    </div>
                    <div className="itemfinder-detail-badges">
                      {selectedItem.section ? <span className="trade-pill">{selectedItem.section}</span> : null}
                      {selectedItem.size ? <span className="trade-pill">{`S${selectedItem.size}`}</span> : null}
                    </div>
                  </div>

                  {selectedItem.screenshot ? (
                    <div className="itemfinder-image-frame">
                      <img src={selectedItem.screenshot} alt={selectedItem.name} className="itemfinder-image" />
                    </div>
                  ) : null}

                  <div className="itemfinder-attribute-grid">
                    {selectedItem.highlightedAttributes.map((attribute) => (
                      <div className="source-card" key={`${selectedItem.id}-${attribute.label}`}>
                        <strong>{attribute.label}</strong>
                        <span>{attribute.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="source-card">
                    <strong>Best buy</strong>
                    {selectedItem.bestBuy ? (
                      <>
                        <span>{formatItemFinderTerminal(selectedItem.bestBuy.terminal)}</span>
                        <span>{`${Number(selectedItem.bestBuy.priceBuy).toLocaleString("en-US")} aUEC`}</span>
                      </>
                    ) : (
                      <span>No live buy data found for this item.</span>
                    )}
                  </div>

                  <div className="source-card">
                    <strong>Where to buy</strong>
                    {selectedItem.buyOffers.length ? (
                      selectedItem.buyOffers.slice(0, 8).map((offer) => (
                        <span key={`${selectedItem.id}-${offer.id}`}>
                          {formatItemFinderTerminal(offer.terminal)} - {Number(offer.priceBuy).toLocaleString("en-US")} aUEC
                        </span>
                      ))
                    ) : (
                      <span>No live buy location found.</span>
                    )}
                  </div>

                  {selectedItem.sellOffers.length ? (
                    <div className="source-card">
                      <strong>Where to sell</strong>
                      {selectedItem.sellOffers.slice(0, 5).map((offer) => (
                        <span key={`${selectedItem.id}-sell-${offer.id}`}>
                          {formatItemFinderTerminal(offer.terminal)} - {Number(offer.priceSell).toLocaleString("en-US")} aUEC
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="empty-text">Select an item to inspect it.</p>
              )}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
