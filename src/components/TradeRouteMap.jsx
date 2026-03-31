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
