import { TRADE_MAP_SYSTEMS, TRADE_MAP_CONNECTIONS } from '../utils/constants';

export default function TradeRouteMap({ route, expanded = false }) {
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
    originSystem,
    destinationSystem,
    originNodeId: `${originSystem}:${originNodeKey}`,
    destinationNodeId: `${destinationSystem}:${destinationNodeKey}`,
    routeNodeIds,
    visibleNodeIds,
    segments
  };
}
