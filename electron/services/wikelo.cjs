const fs = require("fs");

const WIKELO_DATA_URL = "https://raw.githubusercontent.com/SeekND/Wikelo/main/data/wikelo_data.json";
const WIKELO_REPO_BASE = "https://raw.githubusercontent.com/SeekND/Wikelo/main/";
const WIKI_API_BASE = "https://starcitizen.tools/api.php";

function sanitizeWikeloSearchTerm(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildSearchVariants(value) {
  const base = sanitizeWikeloSearchTerm(value);
  const noParens = base.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const firstChunk = base.split(";")[0]?.trim() || "";
  const noQuotes = noParens.replace(/["']/g, "").trim();
  const noCountPrefix = noQuotes.replace(/^\d+x\s+/i, "").trim();
  const noTrailingSlot = noCountPrefix.replace(/\b(Core|Helmet|Legs|Arms|Backpack)\b$/i, "").trim();
  const afterHyphen = noCountPrefix.includes("-") ? noCountPrefix.split("-").pop().trim() : "";
  const variants = [base, noParens, firstChunk, noQuotes, noCountPrefix, noTrailingSlot, afterHyphen];
  return Array.from(new Set(variants.filter(Boolean)));
}

async function fetchWikiSummary(searchTerm) {
  const url = new URL(WIKI_API_BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "prefixsearch");
  url.searchParams.set("gpssearch", searchTerm);
  url.searchParams.set("gpslimit", "1");
  url.searchParams.set("prop", "pageimages|extracts|description|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "800");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wiki search failed for ${searchTerm} with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const pages = Object.values(payload?.query?.pages ?? {});
  const page = pages[0];
  if (!page) return null;

  return {
    title: page.title || searchTerm,
    url: page.fullurl || page.canonicalurl || "",
    extract: page.extract || "",
    description: page.description || "",
    imageUrl: page.thumbnail?.source || ""
  };
}

async function fetchWikiSummaryByTitle(title) {
  const cleanTitle = sanitizeWikeloSearchTerm(title);
  if (!cleanTitle) return null;

  const url = new URL(WIKI_API_BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", cleanTitle);
  url.searchParams.set("prop", "pageimages|extracts|description|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "800");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wiki title lookup failed for ${cleanTitle} with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const pages = Object.values(payload?.query?.pages ?? {});
  const page = pages.find((candidate) => !candidate.missing && Number(candidate.pageid) > 0);
  if (!page) return null;

  return {
    title: page.title || cleanTitle,
    url: page.fullurl || page.canonicalurl || "",
    extract: page.extract || "",
    description: page.description || "",
    imageUrl: page.thumbnail?.source || ""
  };
}

async function fetchWikiSearchTitles(searchTerm) {
  const cleanTerm = sanitizeWikeloSearchTerm(searchTerm);
  if (!cleanTerm) return [];

  const url = new URL(WIKI_API_BASE);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", cleanTerm);
  url.searchParams.set("srlimit", "5");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wiki search failed for ${cleanTerm} with HTTP ${response.status}`);
  }
  const payload = await response.json();
  return (payload?.query?.search ?? []).map((entry) => entry.title).filter(Boolean);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function enrichWikeloData(data) {
  const wikiCache = new Map();

  async function resolveWikiEntry(searchTerms) {
    for (const rawTerm of searchTerms) {
      for (const term of buildSearchVariants(rawTerm)) {
        if (!term) continue;
        if (wikiCache.has(term)) {
          const cached = wikiCache.get(term);
          if (cached) return cached;
          continue;
        }

        try {
          const exact = await fetchWikiSummaryByTitle(term);
          if (exact) {
            wikiCache.set(term, exact);
            return exact;
          }

          const summary = await fetchWikiSummary(term);
          if (summary) {
            wikiCache.set(term, summary);
            return summary;
          }

          const searchTitles = await fetchWikiSearchTitles(term);
          for (const title of searchTitles) {
            const candidate = await fetchWikiSummaryByTitle(title);
            if (candidate) {
              wikiCache.set(term, candidate);
              return candidate;
            }
          }

          wikiCache.set(term, null);
        } catch {
          wikiCache.set(term, null);
        }
      }
    }
    return null;
  }

  const recipeBuckets = [
    ...(Array.isArray(data.items) ? data.items : []),
    ...(Array.isArray(data.ships) ? data.ships : []),
    ...(Array.isArray(data.currency_exchanges) ? data.currency_exchanges : []),
    ...(data.intro_mission ? [data.intro_mission] : [])
  ];

  await mapWithConcurrency(recipeBuckets, 6, async (entry) => {
    const wiki = await resolveWikiEntry([
      entry.mission_name,
      entry.reward,
      entry.name,
      ...String(entry.reward || "").split(";").map((part) => part.trim()),
      ...String(entry.name || "").split(";").map((part) => part.trim())
    ]);
    if (wiki) {
      entry.wiki = wiki;
      if (!entry.image_url && wiki.imageUrl) {
        entry.image_url = wiki.imageUrl;
      } else if (entry.image_url && !String(entry.image_url).startsWith("http")) {
        entry.image_url = `${WIKELO_REPO_BASE}${entry.image_url}`;
      }
    } else if (entry.image_url && !String(entry.image_url).startsWith("http")) {
      entry.image_url = `${WIKELO_REPO_BASE}${entry.image_url}`;
    }
  });

  const ingredientNames = new Set();
  for (const entry of recipeBuckets) {
    for (const part of String(entry.recipe || "").split(";")) {
      const match = part.trim().match(/^(\d+)x\s+(.+)$/i);
      const name = match ? match[2].trim() : part.trim();
      if (name) ingredientNames.add(name);
    }
  }

  if (!data.ingredients_info || typeof data.ingredients_info !== "object") {
    data.ingredients_info = {};
  }

  await mapWithConcurrency(Array.from(ingredientNames), 6, async (name) => {
    const wiki = await resolveWikiEntry(buildSearchVariants(name));
    if (!wiki) return;
    data.ingredients_info[name] = {
      ...(data.ingredients_info[name] || {}),
      location: data.ingredients_info[name]?.location || wiki.extract || "",
      link_url: data.ingredients_info[name]?.link_url || wiki.url || "",
      link_title: data.ingredients_info[name]?.link_title || wiki.title || "",
      description: data.ingredients_info[name]?.description || wiki.description || "",
      image_url: data.ingredients_info[name]?.image_url || wiki.imageUrl || ""
    };
  });

  return data;
}

async function syncWikeloSnapshot(snapshotPath) {
  const response = await fetch(WIKELO_DATA_URL);
  if (!response.ok) {
    throw new Error(`Wikelo sync failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  await enrichWikeloData(data);

  const snapshot = {
    source: "SeekND/Wikelo",
    repo: "https://github.com/SeekND/Wikelo",
    fetchedAt: new Date().toISOString(),
    data
  };

  await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot), "utf8");

  return {
    ok: true,
    fetchedAt: snapshot.fetchedAt,
    counts: {
      items: Array.isArray(data.items) ? data.items.length : 0,
      ships: Array.isArray(data.ships) ? data.ships.length : 0,
      currency: Array.isArray(data.currency_exchanges) ? data.currency_exchanges.length : 0
    }
  };
}

module.exports = {
  syncWikeloSnapshot
};
