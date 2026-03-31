import { useDeferredValue, useEffect, useState } from "react";

import { createDbClient } from "./dbClient";
import { calculateBestRoutes, calculateCircularRoutes, diversifyRoutes, getCargoShips, getSystems, getTerminalLabel, getTradeCommodities, getTradeTerminals, loadTradeSnapshot } from "./tradeData";

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

const TRADE_SYSTEM_NODES = {
  Stanton: [120, 190],
  Pyro: [350, 108],
  Nyx: [590, 196],
  Terra: [690, 86]
};

const TRADE_MAP_SYSTEMS = {
  Stanton: {
    label: "Stanton",
    nodes: {
      "Stanton Star": { x: 156, y: 176, type: "star", label: "Stanton" },
      Crusader: { x: 78, y: 112, type: "planet", label: "Crusader", major: true },
      Cellin: { x: 38, y: 102, type: "moon", label: "Cellin" },
      Daymar: { x: 54, y: 144, type: "moon", label: "Daymar" },
      Yela: { x: 102, y: 148, type: "moon", label: "Yela" },
      Orison: { x: 84, y: 78, type: "station", label: "Orison", major: true },
      "Seraphim Station": { x: 120, y: 96, type: "station", label: "Seraphim", major: true },
      "Grim HEX": { x: 124, y: 128, type: "station", label: "Grim HEX" },
      Hurston: { x: 126, y: 262, type: "planet", label: "Hurston", major: true },
      Aberdeen: { x: 76, y: 246, type: "moon", label: "Aberdeen" },
      Arial: { x: 86, y: 292, type: "moon", label: "Arial" },
      Magda: { x: 144, y: 304, type: "moon", label: "Magda" },
      Ita: { x: 180, y: 262, type: "moon", label: "Ita" },
      Lorville: { x: 126, y: 228, type: "landing", label: "Lorville", major: true },
      "Everus Harbor": { x: 166, y: 224, type: "station", label: "Everus", major: true },
      ArcCorp: { x: 234, y: 142, type: "planet", label: "ArcCorp", major: true },
      Wala: { x: 264, y: 108, type: "moon", label: "Wala" },
      Lyria: { x: 286, y: 154, type: "moon", label: "Lyria" },
      Area18: { x: 234, y: 108, type: "landing", label: "Area18", major: true },
      "Baijini Point": { x: 270, y: 182, type: "station", label: "Baijini", major: true },
      microTech: { x: 240, y: 290, type: "planet", label: "microTech", major: true },
      Calliope: { x: 194, y: 320, type: "moon", label: "Calliope" },
      Clio: { x: 238, y: 338, type: "moon", label: "Clio" },
      Euterpe: { x: 286, y: 322, type: "moon", label: "Euterpe" },
      "New Babbage": { x: 238, y: 254, type: "landing", label: "New Babbage", major: true },
      "Port Tressler": { x: 276, y: 258, type: "station", label: "Tressler", major: true },
      "Pyro Gateway (Stanton)": { x: 304, y: 188, type: "gateway", label: "Pyro Gateway", major: true }
    }
  },
  Pyro: {
    label: "Pyro",
    nodes: {
      "Pyro Star": { x: 156, y: 176, type: "star", label: "Pyro" },
      "Pyro I": { x: 76, y: 112, type: "planet", label: "Pyro I", major: true },
      Monox: { x: 118, y: 274, type: "planet", label: "Monox", major: true },
      Checkmate: { x: 88, y: 314, type: "station", label: "Checkmate", major: true },
      Bloom: { x: 202, y: 102, type: "planet", label: "Bloom", major: true },
      Orbituary: { x: 230, y: 72, type: "station", label: "Orbituary", major: true },
      "Patch City": { x: 236, y: 126, type: "station", label: "Patch City", major: true },
      Terminus: { x: 252, y: 182, type: "planet", label: "Terminus", major: true },
      "Ruin Station": { x: 286, y: 154, type: "station", label: "Ruin", major: true },
      Endgame: { x: 280, y: 200, type: "station", label: "Endgame" },
      "Dudley & Daughters": { x: 250, y: 216, type: "station", label: "Dudley" },
      "Pyro V": { x: 224, y: 296, type: "planet", label: "Pyro V", major: true },
      Ignis: { x: 194, y: 340, type: "moon", label: "Ignis" },
      Vatra: { x: 216, y: 350, type: "moon", label: "Vatra" },
      Adir: { x: 240, y: 348, type: "moon", label: "Adir" },
      Fairo: { x: 264, y: 340, type: "moon", label: "Fairo" },
      Fuego: { x: 282, y: 320, type: "moon", label: "Fuego" },
      Vuur: { x: 274, y: 294, type: "moon", label: "Vuur" },
      Gaslight: { x: 202, y: 266, type: "station", label: "Gaslight" },
      "Rat's Nest": { x: 246, y: 266, type: "station", label: "Rat's Nest" },
      "Rod's Fuel": { x: 254, y: 322, type: "station", label: "Rod's Fuel" },
      "Starlight Service": { x: 182, y: 130, type: "station", label: "Starlight" },
      "Stanton Gateway (Pyro)": { x: 24, y: 188, type: "gateway", label: "Stanton Gateway", major: true },
      "Nyx Gateway (Pyro)": { x: 304, y: 188, type: "gateway", label: "Nyx Gateway", major: true }
    }
  },
  Nyx: {
    label: "Nyx",
    nodes: {
      "Nyx Star": { x: 156, y: 176, type: "star", label: "Nyx" },
      Delamar: { x: 118, y: 212, type: "asteroid", label: "Delamar", major: true },
      Levski: { x: 118, y: 176, type: "landing", label: "Levski", major: true },
      "Glaciem Ring": { x: 202, y: 112, type: "belt", label: "Glaciem Ring" },
      "Pyro Gateway (Nyx)": { x: 284, y: 188, type: "gateway", label: "Pyro Gateway", major: true }
    }
  }
};

const TRADE_MAP_CONNECTIONS = {
  Stanton: {
    Pyro: {
      exitNode: "Pyro Gateway (Stanton)",
      entryNode: "Stanton Gateway (Pyro)",
      jumpLabel: "Stanton - Pyro Jump Point"
    }
  },
  Pyro: {
    Stanton: {
      exitNode: "Stanton Gateway (Pyro)",
      entryNode: "Pyro Gateway (Stanton)",
      jumpLabel: "Stanton - Pyro Jump Point"
    },
    Nyx: {
      exitNode: "Nyx Gateway (Pyro)",
      entryNode: "Pyro Gateway (Nyx)",
      jumpLabel: "Pyro - Nyx Jump Point"
    }
  },
  Nyx: {
    Pyro: {
      exitNode: "Pyro Gateway (Nyx)",
      entryNode: "Nyx Gateway (Pyro)",
      jumpLabel: "Pyro - Nyx Jump Point"
    }
  }
};

const CARGO_SHIPS = ["C2 Hercules", "M2 Hercules", "Caterpillar", "Mercury Star Runner", "Freelancer MAX", "Hull A"];
const COMBAT_SHIPS = ["Arrow", "Gladius", "Hawk", "Talon", "Hornet Mk II", "Sabre", "Scorpius"];
const LOADOUT_SLOTS = ["Power", "Cooler", "Shield", "Quantum", "Weapons", "Missiles", "Utility"];

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

function fmtNumber(value) {
  return new Intl.NumberFormat("en-US").format(toNumber(value));
}

function fmtMoney(value) {
  return `${fmtNumber(Math.round(toNumber(value)))} aUEC`;
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
      <div className="hero-noise" />
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
        <div className="section-title-stack">
          <h3>{title}</h3>
          <span className="section-rule" />
        </div>
      </header>
      {children}
    </section>
  );
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(haystack, values) {
  return values.some((value) => haystack.includes(value));
}

function resolveTradeBodyNode(systemName, terminalName, regionText) {
  const system = TRADE_MAP_SYSTEMS[systemName];
  if (!system) return null;

  const haystack = normalizeLabel(`${terminalName} ${regionText}`);

  const matchers = {
    Stanton: [
      [["new babbage"], "New Babbage"],
      [["port tressler", "tressler"], "Port Tressler"],
      [["area18", "area 18"], "Area18"],
      [["baijini"], "Baijini Point"],
      [["lorville"], "Lorville"],
      [["everus"], "Everus Harbor"],
      [["orison"], "Orison"],
      [["seraphim"], "Seraphim Station"],
      [["grim hex", "grimhex"], "Grim HEX"],
      [["pyro gateway"], "Pyro Gateway (Stanton)"],
      [["clio"], "Clio"],
      [["calliope"], "Calliope"],
      [["euterpe"], "Euterpe"],
      [["microtech", "micro tech", "mic ", "mic-"], "microTech"],
      [["lyria"], "Lyria"],
      [["wala"], "Wala"],
      [["arccorp", "arc corp", "arc ", "arc-"], "ArcCorp"],
      [["aberdeen"], "Aberdeen"],
      [["arial"], "Arial"],
      [["magda"], "Magda"],
      [["ita"], "Ita"],
      [["hurston", "hur ", "hur-"], "Hurston"],
      [["cellin"], "Cellin"],
      [["daymar"], "Daymar"],
      [["yela"], "Yela"],
      [["crusader", "cru ", "cru-"], "Crusader"]
    ],
    Pyro: [
      [["checkmate"], "Checkmate"],
      [["orbituary"], "Orbituary"],
      [["patch city"], "Patch City"],
      [["ruin station"], "Ruin Station"],
      [["endgame"], "Endgame"],
      [["dudley"], "Dudley & Daughters"],
      [["gaslight"], "Gaslight"],
      [["rat s nest", "rats nest"], "Rat's Nest"],
      [["rod s fuel", "rods fuel"], "Rod's Fuel"],
      [["starlight"], "Starlight Service"],
      [["stanton gateway"], "Stanton Gateway (Pyro)"],
      [["nyx gateway"], "Nyx Gateway (Pyro)"],
      [["monox"], "Monox"],
      [["bloom"], "Bloom"],
      [["terminus"], "Terminus"],
      [["fairo"], "Fairo"],
      [["fuego"], "Fuego"],
      [["vuur"], "Vuur"],
      [["adir"], "Adir"],
      [["vatra"], "Vatra"],
      [["ignis"], "Ignis"],
      [["pyro v", "pyro 5"], "Pyro V"],
      [["pyro i", "pyro 1"], "Pyro I"]
    ],
    Nyx: [
      [["levski"], "Levski"],
      [["delamar"], "Delamar"],
      [["pyro gateway"], "Pyro Gateway (Nyx)"],
      [["glaciem"], "Glaciem Ring"]
    ]
  };

  for (const [needles, nodeKey] of matchers[systemName] || []) {
    if (includesAny(haystack, needles)) return nodeKey;
  }

  const fallbackNode = Object.entries(system.nodes).find(([, node]) => node.major && (node.type === "planet" || node.type === "station" || node.type === "landing" || node.type === "gateway"));
  return fallbackNode?.[0] || Object.keys(system.nodes)[0];
}

function findSystemPath(start, goal) {
  if (!start || !goal) return [start || goal].filter(Boolean);
  if (start === goal) return [start];

  const queue = [[start]];
  const seen = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const neighbors = Object.keys(TRADE_MAP_CONNECTIONS[current] || {});

    for (const neighbor of neighbors) {
      if (seen.has(neighbor)) continue;
      const nextPath = [...path, neighbor];
      if (neighbor === goal) return nextPath;
      seen.add(neighbor);
      queue.push(nextPath);
    }
  }

  return [start, goal];
}

function buildTradeRouteGraph(route) {
  if (!route) return null;

  const routeLegs = route.mode === "circular" ? route.legs : [route];
  if (!routeLegs?.length) return null;

  const originSystem = routeLegs[0].originSystem || "Stanton";
  const destinationSystem = routeLegs[routeLegs.length - 1].destinationSystem || originSystem;

  const systemWalk = [];
  for (const leg of routeLegs) {
    const legPath = findSystemPath(leg.originSystem || "Stanton", leg.destinationSystem || leg.originSystem || "Stanton");
    for (const [index, systemName] of legPath.entries()) {
      if (systemWalk.length && index === 0 && systemWalk[systemWalk.length - 1] === systemName) continue;
      systemWalk.push(systemName);
    }
  }

  const systems = systemWalk.filter((name, index) => systemWalk.indexOf(name) === index && TRADE_MAP_SYSTEMS[name]);

  const panelWidth = 328;
  const panelGap = 86;
  const topOffset = 82;
  const sidePadding = 56;
  const panelHeight = 392;

  const panels = systems.map((systemName, index) => ({
    systemName,
    layout: TRADE_MAP_SYSTEMS[systemName],
    x: sidePadding + index * (panelWidth + panelGap),
    y: topOffset,
    width: panelWidth,
    height: panelHeight
  }));

  const panelBySystem = new Map(panels.map((panel) => [panel.systemName, panel]));
  const globalNodes = new Map();

  for (const panel of panels) {
    for (const [nodeKey, node] of Object.entries(panel.layout.nodes)) {
      globalNodes.set(`${panel.systemName}:${nodeKey}`, {
        key: `${panel.systemName}:${nodeKey}`,
        systemName: panel.systemName,
        nodeKey,
        ...node,
        gx: panel.x + node.x,
        gy: panel.y + node.y
      });
    }
  }

  const originNodeKey = resolveTradeBodyNode(originSystem, routeLegs[0].originName, routeLegs[0].originRegion);
  const destinationNodeKey = resolveTradeBodyNode(destinationSystem, routeLegs[routeLegs.length - 1].destinationName, routeLegs[routeLegs.length - 1].destinationRegion);
  const routeNodeIds = new Set([`${originSystem}:${originNodeKey}`, `${destinationSystem}:${destinationNodeKey}`]);
  const segments = [];

  for (const leg of routeLegs) {
    const legOriginSystem = leg.originSystem || "Stanton";
    const legDestinationSystem = leg.destinationSystem || legOriginSystem;
    const legOriginNodeKey = resolveTradeBodyNode(legOriginSystem, leg.originName, leg.originRegion);
    const legDestinationNodeKey = resolveTradeBodyNode(legDestinationSystem, leg.destinationName, leg.destinationRegion);
    const legSystemPath = findSystemPath(legOriginSystem, legDestinationSystem);
    let currentNodeId = `${legOriginSystem}:${legOriginNodeKey}`;

    routeNodeIds.add(currentNodeId);
    routeNodeIds.add(`${legDestinationSystem}:${legDestinationNodeKey}`);

    if (legSystemPath.length === 1) {
      const destinationNodeId = `${legDestinationSystem}:${legDestinationNodeKey}`;
      if (globalNodes.has(currentNodeId) && globalNodes.has(destinationNodeId) && currentNodeId !== destinationNodeId) {
        segments.push({ from: currentNodeId, to: destinationNodeId, kind: "local" });
      }
      continue;
    }

    for (let index = 0; index < legSystemPath.length - 1; index += 1) {
      const currentSystem = legSystemPath[index];
      const nextSystem = legSystemPath[index + 1];
      const connection = TRADE_MAP_CONNECTIONS[currentSystem]?.[nextSystem];
      if (!connection) continue;

      const exitNodeId = `${currentSystem}:${connection.exitNode}`;
      const entryNodeId = `${nextSystem}:${connection.entryNode}`;

      routeNodeIds.add(exitNodeId);
      routeNodeIds.add(entryNodeId);

      if (globalNodes.has(currentNodeId) && globalNodes.has(exitNodeId) && currentNodeId !== exitNodeId) {
        segments.push({ from: currentNodeId, to: exitNodeId, kind: "local" });
      }

      if (globalNodes.has(exitNodeId) && globalNodes.has(entryNodeId)) {
        segments.push({ from: exitNodeId, to: entryNodeId, kind: "jump", label: connection.jumpLabel });
      }

      currentNodeId = entryNodeId;
    }

    const finalNodeId = `${legDestinationSystem}:${legDestinationNodeKey}`;
    if (globalNodes.has(currentNodeId) && globalNodes.has(finalNodeId) && currentNodeId !== finalNodeId) {
      segments.push({ from: currentNodeId, to: finalNodeId, kind: "local" });
    }
  }

  const visibleNodeIds = new Set();
  for (const [nodeId, node] of globalNodes.entries()) {
    const alwaysVisible = node.type === "planet" || node.major === true;
    if (alwaysVisible || routeNodeIds.has(nodeId)) {
      visibleNodeIds.add(nodeId);
    }
  }

  return {
    width: sidePadding * 2 + panels.length * panelWidth + Math.max(0, panels.length - 1) * panelGap,
    height: 560,
    panels,
    globalNodes,
    systems,
    routeNodeIds,
    visibleNodeIds,
    segments,
    originSystem,
    destinationSystem,
    originNodeId: `${originSystem}:${originNodeKey}`,
    destinationNodeId: `${destinationSystem}:${destinationNodeKey}`
  };
}

function TradeRouteMap({ route, expanded = false }) {
  const graph = buildTradeRouteGraph(route);
  if (!route || !graph) return null;
  const sameSystem = graph.originSystem === graph.destinationSystem;

  return (
    <div className={`trade-map-card ${expanded ? "is-expanded" : ""}`}>
      <div className="trade-map-head">
        <strong>Route map</strong>
        <span>{sameSystem ? graph.originSystem : `${graph.originSystem} -> ${graph.destinationSystem}`}</span>
      </div>
      <div className={`route-map ${expanded ? "is-expanded" : ""}`}>
        <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className={`route-map-svg ${expanded ? "is-expanded" : ""}`} aria-hidden="true">
          <defs>
            <linearGradient id="routeLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#13d4ff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#f3f3f3" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="jumpLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#13d4ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#59f58a" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={graph.width} height={graph.height} fill="transparent" />

          {graph.panels.map((panel) => (
            <g key={panel.systemName} className="route-system-panel">
              <rect x={panel.x} y={panel.y} width={panel.width} height={panel.height} rx="22" />
              <text x={panel.x + 20} y={panel.y + 30} className="route-system-label">{panel.layout.label}</text>
            </g>
          ))}

          {graph.panels.map((panel) => (
            <g key={`${panel.systemName}-grid`} className="route-map-grid">
              {Array.from({ length: 5 }).map((_, index) => (
                <line key={`v-${panel.systemName}-${index}`} x1={panel.x + 44 + index * 52} y1={panel.y + 44} x2={panel.x + 44 + index * 52} y2={panel.y + panel.height - 26} />
              ))}
              {Array.from({ length: 5 }).map((_, index) => (
                <line key={`h-${panel.systemName}-${index}`} x1={panel.x + 26} y1={panel.y + 62 + index * 60} x2={panel.x + panel.width - 26} y2={panel.y + 62 + index * 60} />
              ))}
            </g>
          ))}

          {graph.segments.map((segment, index) => {
            const from = graph.globalNodes.get(segment.from);
            const to = graph.globalNodes.get(segment.to);
            if (!from || !to) return null;

            const mx = (from.gx + to.gx) / 2;
            const my = (from.gy + to.gy) / 2;

            return (
              <g key={`segment-${index}`} className={`route-map-segment ${segment.kind}`}>
                <path
                  d={`M ${from.gx} ${from.gy} Q ${mx} ${Math.min(from.gy, to.gy) - 24} ${to.gx} ${to.gy}`}
                  className={segment.kind === "jump" ? "route-map-jump" : "route-map-link"}
                />
                {segment.kind === "jump" && segment.label ? (
                  <text x={mx} y={my - 26} className="route-map-jump-label">{segment.label}</text>
                ) : null}
              </g>
            );
          })}

          {Array.from(graph.globalNodes.values())
            .filter((node) => graph.visibleNodeIds.has(node.key))
            .map((node) => {
            const isRouteNode = graph.routeNodeIds.has(node.key);
            const isOrigin = node.key === graph.originNodeId;
            const isDestination = node.key === graph.destinationNodeId;

            return (
              <g
                key={node.key}
                className={`route-map-node type-${node.type} ${isRouteNode ? "is-active" : ""} ${isOrigin ? "is-origin" : ""} ${isDestination ? "is-destination" : ""}`}
              >
                <circle cx={node.gx} cy={node.gy} r={node.type === "star" ? 9 : node.type === "planet" ? 7 : node.type === "moon" ? 4 : 5} />
                <text x={node.gx} y={node.gy + (node.type === "moon" ? 16 : 20)}>{node.label}</text>
              </g>
            );
          })}
        </svg>

        <div className="route-map-label route-map-label-origin">
          <strong>Buy</strong>
          <span>{route.originName}</span>
          <small>{route.originRegion}</small>
        </div>

        <div className="route-map-label route-map-label-destination">
          <strong>Sell</strong>
          <span>{route.destinationName}</span>
          <small>{route.destinationRegion}</small>
        </div>
      </div>
    </div>
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
                        <span>
                          {slot.required.toFixed(3)} SCU (min {slot.minQuality})
                        </span>
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

function TradeRoutesPage({ visual }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [ships, setShips] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [systems, setSystems] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [preferredDraft, setPreferredDraft] = useState("");
  const [avoidDraft, setAvoidDraft] = useState("");
  const [overlayState, setOverlayState] = useState({ visible: false, progressIndex: 0, route: null });
  const [form, setForm] = useState({
    routeMode: "single",
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
      includeCommodityIds: form.includeCommodityIds,
      excludeCommodityIds: form.excludeCommodityIds
    };
    const nextResults = form.routeMode === "circular"
      ? calculateCircularRoutes(snapshot, routeOptions)
      : calculateBestRoutes(snapshot, routeOptions);
    setResults(nextResults);
    setSelectedIndex(0);
  }, [snapshot, form]);

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

  const visibleResults = form.routeMode === "circular" ? results.slice(0, 24) : diversifyRoutes(results, 2, 24);
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
            <span>{results.length} routes</span>
            <span>Best {fmtMoney(results[0]?.profit ?? 0)}</span>
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
          {!loading && !results.length ? <p className="empty-text">No profitable {form.routeMode === "circular" ? "loop" : "route"} found for the current budget, ship and origin.</p> : null}
          {!!results.length ? (
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
                        <span className="trade-leg">{item.legs[0]?.originName}</span>
                        <span className="trade-arrow">-&gt;</span>
                        <span className="trade-leg">{item.legs[0]?.destinationName}</span>
                        <span className="trade-arrow">-&gt;</span>
                        <span className="trade-leg">{item.legs[1]?.destinationName}</span>
                        <span className="trade-arrow">-&gt;</span>
                        <span className="trade-leg">{item.legs[2]?.destinationName}</span>
                      </div>
                      <div className="trade-route-locations trade-loop-lines">
                        {item.legs.map((leg, legIndex) => (
                          <span key={`loop-${index}-${legIndex}`}>Leg {legIndex + 1}: {leg.commodityName} · {leg.originName} → {leg.destinationName}</span>
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
                      <small>{item.mode === "circular" ? "Avg / leg" : "Profit / SCU"}</small>
                      <strong>{fmtMoney(item.mode === "circular" ? item.avgLegProfit : item.unitProfit)}</strong>
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
                        <span>{leg.originName} → {leg.destinationName}</span>
                        <span>{fmtMoney(leg.profit)}</span>
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
                      <strong>Avg profit / leg</strong>
                      <span>{fmtMoney(visibleSelectedRoute.avgLegProfit)}</span>
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
                  <strong>{visibleSelectedRoute.mode === "circular" ? "Loop investment" : "Investment"}</strong>
                  <span>{fmtMoney(visibleSelectedRoute.investment)}</span>
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
                    ? `${visibleSelectedRoute.commodityCount} commodity types / ${visibleSelectedRoute.legs.length} trade legs`
                    : `Buy stock ${fmtNumber(visibleSelectedRoute.availabilityScu)} / destination demand ${fmtNumber(visibleSelectedRoute.destinationDemandScu)}`}
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
