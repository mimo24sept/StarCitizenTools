import { TRADE_MAP_CONNECTIONS } from './utils/constants';

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueParts(parts) {
  return [...new Set(parts.filter(Boolean))];
}

export function getDistancePairKey(originTerminalId, destinationTerminalId) {
  const left = safeNumber(originTerminalId, 0);
  const right = safeNumber(destinationTerminalId, 0);
  if (!left || !right) return "";
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

export async function loadTradeSnapshot() {
  const result = await window.desktopAPI.getTradeSnapshot();
  if (!result.ok) {
    return null;
  }
  return result.snapshot;
}

export function getCargoShips(snapshot) {
  return (snapshot?.vehicles ?? [])
    .filter((item) => item.isSpaceship && safeNumber(item.scu) > 0)
    .sort((left, right) => {
      if (right.scu !== left.scu) return right.scu - left.scu;
      return (left.fullName || left.name).localeCompare(right.fullName || right.name);
    });
}

export function getTradeTerminals(snapshot) {
  return (snapshot?.terminals ?? [])
    .filter((item) => item.isVisible && item.isAvailableLive && (item.type === "commodity" || item.type === "commodity_raw"))
    .sort((left, right) => getTerminalLabel(left).localeCompare(getTerminalLabel(right)));
}

export function getSystems(snapshot) {
  const values = new Set();
  for (const terminal of getTradeTerminals(snapshot)) {
    if (terminal.starSystem) values.add(terminal.starSystem);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function getTradeCommodities(snapshot) {
  const visibleCommodityIds = new Set((snapshot?.prices ?? []).map((item) => item.commodityId));
  return (snapshot?.commodities ?? [])
    .filter((item) => item.isVisible && item.isAvailableLive && visibleCommodityIds.has(item.id))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getTerminalLabel(terminal) {
  return terminal?.displayName || terminal?.nickname || terminal?.name || "Unknown terminal";
}

export function getTerminalSubLabel(terminal) {
  if (!terminal) return "";
  return uniqueParts([terminal.city, terminal.station, terminal.outpost, terminal.moon, terminal.planet, terminal.starSystem]).join(" / ");
}

function buildIndexes(snapshot) {
  const terminals = getTradeTerminals(snapshot);
  const terminalById = new Map(terminals.map((item) => [item.id, item]));
  const commodityById = new Map((snapshot?.commodities ?? []).map((item) => [item.id, item]));
  return { terminalById, commodityById };
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

function estimateInSystemTravelMinutes(originTerminal, destinationTerminal) {
  if (!originTerminal || !destinationTerminal) return 16;
  if (originTerminal.id === destinationTerminal.id) return 1;

  const sameStation = originTerminal.station && destinationTerminal.station && originTerminal.station === destinationTerminal.station;
  const sameCity = originTerminal.city && destinationTerminal.city && originTerminal.city === destinationTerminal.city;
  const sameOutpost = originTerminal.outpost && destinationTerminal.outpost && originTerminal.outpost === destinationTerminal.outpost;
  if (sameStation || sameCity || sameOutpost) return 4;

  const sameOrbit = originTerminal.orbit && destinationTerminal.orbit && originTerminal.orbit === destinationTerminal.orbit;
  if (sameOrbit) return 6;

  const sameMoon = originTerminal.moon && destinationTerminal.moon && originTerminal.moon === destinationTerminal.moon;
  if (sameMoon) return 8;

  const samePlanet = originTerminal.planet && destinationTerminal.planet && originTerminal.planet === destinationTerminal.planet;
  if (samePlanet) return 12;

  return 18;
}

function estimateTravelMinutes(originTerminal, destinationTerminal) {
  if (!originTerminal || !destinationTerminal) return 24;

  if (originTerminal.starSystem === destinationTerminal.starSystem) {
    return estimateInSystemTravelMinutes(originTerminal, destinationTerminal);
  }

  const systemPath = findSystemPath(originTerminal.starSystem, destinationTerminal.starSystem);
  const jumpCount = Math.max(1, systemPath.length - 1);
  const originSide = estimateInSystemTravelMinutes(originTerminal, { ...originTerminal, id: -1, station: 'gateway' });
  const destinationSide = estimateInSystemTravelMinutes(destinationTerminal, { ...destinationTerminal, id: -2, station: 'gateway' });
  return originSide + destinationSide + jumpCount * 22;
}

function estimateTradeDurationMinutes(originTerminal, destinationTerminal, resolvedDistanceGm = null) {
  if (Number.isFinite(resolvedDistanceGm) && resolvedDistanceGm > 0) {
    const terminalOpsMinutes = 4;
    const transitMinutes = Math.max(2, resolvedDistanceGm / 8);
    return terminalOpsMinutes + transitMinutes;
  }
  const serviceMinutes = 4;
  return estimateTravelMinutes(originTerminal, destinationTerminal) + serviceMinutes;
}

function createRouteFromListings(buy, sell, originTerminal, destinationTerminal, commodity, availableBudget, cargoCapacity) {
  const byBudget = Math.floor(availableBudget / buy.priceBuy);
  const byCargo = cargoCapacity;
  const bySupply = buy.scuBuy > 0 ? Math.floor(buy.scuBuy) : cargoCapacity;
  const maxPurchasableScu = Math.min(byBudget, byCargo, bySupply);
  if (maxPurchasableScu < 1) return null;

  const unitProfit = safeNumber(sell.priceSell) - safeNumber(buy.priceBuy);
  if (unitProfit <= 0) return null;

  const byDemand = sell.scuSellStock > 0 ? Math.floor(sell.scuSellStock) : maxPurchasableScu;
  const quantity = Math.min(maxPurchasableScu, byDemand);
  if (quantity < 1) return null;

  const investment = quantity * buy.priceBuy;
  const revenue = quantity * sell.priceSell;
  const profit = revenue - investment;
  const marginPercent = investment > 0 ? (profit / investment) * 100 : 0;
  const estimatedMinutes = estimateTradeDurationMinutes(originTerminal, destinationTerminal);
  const profitPerMinute = estimatedMinutes > 0 ? profit / estimatedMinutes : profit;

  return {
    mode: "single",
    commodityId: buy.commodityId,
    commodityName: commodity.name,
    commodityKind: commodity.kind,
    isIllegal: commodity.isIllegal,
    originTerminalId: originTerminal.id,
    originName: getTerminalLabel(originTerminal),
    originRegion: getTerminalSubLabel(originTerminal),
    destinationTerminalId: destinationTerminal.id,
    destinationName: getTerminalLabel(destinationTerminal),
    destinationRegion: getTerminalSubLabel(destinationTerminal),
    originSystem: originTerminal.starSystem,
    destinationSystem: destinationTerminal.starSystem,
    buyPrice: buy.priceBuy,
    sellPrice: sell.priceSell,
    unitProfit,
    quantity,
    investment,
    revenue,
    profit,
    marginPercent,
    estimatedMinutes,
    profitPerMinute,
    availabilityScu: buy.scuBuy,
    destinationDemandScu: sell.scuSellStock
  };
}

function compareRoutes(left, right, sortBy) {
  if (sortBy === "efficiency") {
    if ((right.profitPerMinute ?? 0) !== (left.profitPerMinute ?? 0)) return (right.profitPerMinute ?? 0) - (left.profitPerMinute ?? 0);
  } else if (sortBy === "time") {
    if ((left.estimatedMinutes ?? 0) !== (right.estimatedMinutes ?? 0)) return (left.estimatedMinutes ?? 0) - (right.estimatedMinutes ?? 0);
  } else if (sortBy === "unit") {
    if (right.unitProfit !== left.unitProfit) return right.unitProfit - left.unitProfit;
  } else if (sortBy === "margin") {
    if (right.marginPercent !== left.marginPercent) return right.marginPercent - left.marginPercent;
  } else {
    if (right.profit !== left.profit) return right.profit - left.profit;
  }
  if ((right.quantity ?? 0) !== (left.quantity ?? 0)) return (right.quantity ?? 0) - (left.quantity ?? 0);
  return String(left.commodityName || left.loopLabel || "").localeCompare(String(right.commodityName || right.loopLabel || ""));
}

function buildProfitableRoutes(snapshot, options) {
  if (!snapshot) return [];

  const budget = Math.max(0, Math.floor(safeNumber(options.budget, 0)));
  const cargoCapacity = Math.max(0, Math.floor(safeNumber(options.cargoCapacity, 0)));
  const originTerminalId = safeNumber(options.originTerminalId, 0);
  const selectedSystem = options.destinationSystem || "";
  const legalityFilter = options.legalityFilter || "all";
  const includeCommodityIds = new Set((options.includeCommodityIds ?? []).map((item) => safeNumber(item)).filter(Boolean));
  const excludeCommodityIds = new Set((options.excludeCommodityIds ?? []).map((item) => safeNumber(item)).filter(Boolean));

  if (!budget || !cargoCapacity) return [];

  const { terminalById, commodityById } = buildIndexes(snapshot);
  const listings = snapshot.prices ?? [];
  const buyListings = listings.filter((item) => {
    if (!(item.priceBuy > 0 && item.statusBuy > 0)) return false;
    if (!originTerminalId) return terminalById.has(item.terminalId);
    return item.terminalId === originTerminalId;
  });
  const sellListingsByCommodity = new Map();

  for (const listing of listings) {
    if (!(listing.priceSell > 0 && listing.statusSell > 0)) continue;
    const terminal = terminalById.get(listing.terminalId);
    if (!terminal || listing.terminalId === originTerminalId) continue;
    if (selectedSystem && terminal.starSystem !== selectedSystem) continue;
    if (!sellListingsByCommodity.has(listing.commodityId)) {
      sellListingsByCommodity.set(listing.commodityId, []);
    }
    sellListingsByCommodity.get(listing.commodityId).push(listing);
  }

  const routes = [];
  for (const buy of buyListings) {
    const originTerminal = terminalById.get(buy.terminalId);
    if (!originTerminal) continue;
    const commodity = commodityById.get(buy.commodityId);
    if (!commodity || !commodity.isVisible || !commodity.isAvailableLive) continue;
    if (includeCommodityIds.size && !includeCommodityIds.has(buy.commodityId)) continue;
    if (excludeCommodityIds.has(buy.commodityId)) continue;
    if (legalityFilter === "legal" && commodity.isIllegal) continue;
    if (legalityFilter === "illegal" && !commodity.isIllegal) continue;

    const destinations = sellListingsByCommodity.get(buy.commodityId) ?? [];
    for (const sell of destinations) {
      const destinationTerminal = terminalById.get(sell.terminalId);
      if (!destinationTerminal) continue;

      const route = createRouteFromListings(buy, sell, originTerminal, destinationTerminal, commodity, budget, cargoCapacity);
      if (route) routes.push(route);
    }
  }

  return routes;
}

export function calculateBestRoutes(snapshot, options) {
  const sortBy = options.sortBy || "profit";
  const routes = buildProfitableRoutes(snapshot, options);
  routes.sort((left, right) => compareRoutes(left, right, sortBy));
  return routes.slice(0, 100);
}

export function sortTradeRoutes(routes, sortBy = "profit") {
  return [...(routes ?? [])].sort((left, right) => compareRoutes(left, right, sortBy));
}

export function calculateCircularRoutes(snapshot, options) {
  if (!snapshot) return [];

  const budget = Math.max(0, Math.floor(safeNumber(options.budget, 0)));
  const cargoCapacity = Math.max(0, Math.floor(safeNumber(options.cargoCapacity, 0)));
  const originTerminalId = safeNumber(options.originTerminalId, 0);
  const sortBy = options.sortBy || "profit";
  const loopLegCount = Math.min(5, Math.max(3, Math.floor(safeNumber(options.loopLegCount, 3))));
  if (!budget || !cargoCapacity) return [];

  const baseRoutes = buildProfitableRoutes(snapshot, { ...options, originTerminalId: 0 });
  const outgoingByOrigin = new Map();
  for (const route of baseRoutes) {
    if (!outgoingByOrigin.has(route.originTerminalId)) outgoingByOrigin.set(route.originTerminalId, []);
    outgoingByOrigin.get(route.originTerminalId).push(route);
  }

  for (const list of outgoingByOrigin.values()) {
    list.sort((left, right) => compareRoutes(left, right, sortBy));
  }

  const startTerminalIds = originTerminalId ? [originTerminalId] : Array.from(outgoingByOrigin.keys());
  const loops = [];
  const seen = new Set();
  const maxLoops = 120;
  const branchFactor = loopLegCount >= 5 ? 4 : 6;

  function recalcLeg(baseRoute, availableFunds) {
    const byBudget = Math.floor(availableFunds / baseRoute.buyPrice);
    const byCargo = cargoCapacity;
    const bySupply = baseRoute.availabilityScu > 0 ? Math.floor(baseRoute.availabilityScu) : cargoCapacity;
    const maxPurchasableScu = Math.min(byBudget, byCargo, bySupply);
    if (maxPurchasableScu < 1) return null;
    const byDemand = baseRoute.destinationDemandScu > 0 ? Math.floor(baseRoute.destinationDemandScu) : maxPurchasableScu;
    const quantity = Math.min(maxPurchasableScu, byDemand);
    if (quantity < 1) return null;
    const investment = quantity * baseRoute.buyPrice;
    const revenue = quantity * baseRoute.sellPrice;
    const profit = revenue - investment;
    if (profit <= 0) return null;
    return {
      ...baseRoute,
      quantity,
      investment,
      revenue,
      profit,
      marginPercent: investment > 0 ? (profit / investment) * 100 : 0
    };
  }

  function scoreBaseRoute(route) {
    if (sortBy === "efficiency") return route.profitPerMinute ?? 0;
    if (sortBy === "margin") return route.marginPercent ?? 0;
    if (sortBy === "unit") return route.unitProfit ?? 0;
    return route.profit ?? 0;
  }

  function buildLoopFromBases(loopBases, startingFunds) {
    let funds = startingFunds;
    const legs = [];

    for (const baseLeg of loopBases) {
      const leg = recalcLeg(baseLeg, funds);
      if (!leg) return null;
      funds += leg.profit;
      legs.push(leg);
    }

    const totalProfit = legs.reduce((sum, leg) => sum + leg.profit, 0);
    const totalInvestment = legs.reduce((sum, leg) => sum + leg.investment, 0);
    const endingFunds = startingFunds + totalProfit;
    const unitProfit = totalProfit / Math.max(cargoCapacity, 1);
    const avgLegProfit = totalProfit / legs.length;
    const totalMinutes = legs.reduce((sum, leg) => sum + (leg.estimatedMinutes || 0), 0);
    const profitPerMinute = totalMinutes > 0 ? totalProfit / totalMinutes : totalProfit;
    const uniqueCommodities = [...new Set(legs.map((leg) => leg.commodityName))];

    return {
      mode: "circular",
      loopLabel: [legs[0].originName, ...legs.map((leg) => leg.destinationName)].join(" -> "),
      commodityName: uniqueCommodities.join(" / "),
      commoditySummary: uniqueCommodities.join(" / "),
      commodityCount: uniqueCommodities.length,
      originTerminalId: legs[0].originTerminalId,
      originName: legs[0].originName,
      originRegion: legs[0].originRegion,
      destinationTerminalId: legs[legs.length - 1].destinationTerminalId,
      destinationName: legs[legs.length - 1].destinationName,
      destinationRegion: legs[legs.length - 1].destinationRegion,
      originSystem: legs[0].originSystem,
      destinationSystem: legs[legs.length - 1].destinationSystem,
      isIllegal: legs.some((leg) => leg.isIllegal),
      legs,
      quantity: Math.min(...legs.map((leg) => leg.quantity)),
      profit: totalProfit,
      unitProfit,
      avgLegProfit,
      investment: totalInvestment,
      endingFunds,
      marginPercent: startingFunds > 0 ? (totalProfit / startingFunds) * 100 : 0,
      estimatedMinutes: totalMinutes,
      profitPerMinute,
      availabilityScu: Math.min(...legs.map((leg) => leg.availabilityScu || cargoCapacity)),
      destinationDemandScu: Math.min(...legs.map((leg) => leg.destinationDemandScu || cargoCapacity))
    };
  }

  function walkLoop(startId, currentId, visited, pathBases) {
    if (loops.length >= maxLoops) return;

    const depth = pathBases.length;
    const remaining = loopLegCount - depth;
    const candidates = (outgoingByOrigin.get(currentId) ?? [])
      .filter((item) => {
        if (remaining === 1) return item.destinationTerminalId === startId;
        return item.destinationTerminalId !== startId && item.destinationTerminalId !== currentId && !visited.has(item.destinationTerminalId);
      })
      .sort((left, right) => scoreBaseRoute(right) - scoreBaseRoute(left))
      .slice(0, branchFactor);

    for (const candidate of candidates) {
      const nextPath = [...pathBases, candidate];
      if (remaining === 1) {
        const signature = nextPath.map((leg) => `${leg.originTerminalId}:${leg.destinationTerminalId}:${leg.commodityId}`).join("|");
        if (seen.has(signature)) continue;
        seen.add(signature);
        const loop = buildLoopFromBases(nextPath, budget);
        if (loop) loops.push(loop);
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(candidate.destinationTerminalId);
      walkLoop(startId, candidate.destinationTerminalId, nextVisited, nextPath);
      if (loops.length >= maxLoops) return;
    }
  }

  for (const startId of startTerminalIds) {
    walkLoop(startId, startId, new Set([startId]), []);
    if (loops.length >= maxLoops) break;
  }

  loops.sort((left, right) => compareRoutes(left, right, sortBy));
  return loops.slice(0, 60);
}

export function enrichRoutesWithDistanceMap(routes, snapshot, distanceMap = {}) {
  if (!snapshot || !routes?.length) return routes ?? [];

  const { terminalById } = buildIndexes(snapshot);

  function enrichLeg(leg) {
    const originTerminal = terminalById.get(leg.originTerminalId);
    const destinationTerminal = terminalById.get(leg.destinationTerminalId);
    const distanceKey = getDistancePairKey(leg.originTerminalId, leg.destinationTerminalId);
    const resolvedDistanceGm = Number(distanceMap?.[distanceKey]);
    const estimatedMinutes = estimateTradeDurationMinutes(
      originTerminal,
      destinationTerminal,
      Number.isFinite(resolvedDistanceGm) ? resolvedDistanceGm : null
    );
    return {
      ...leg,
      distanceGm: Number.isFinite(resolvedDistanceGm) ? resolvedDistanceGm : leg.distanceGm ?? null,
      estimatedMinutes,
      profitPerMinute: estimatedMinutes > 0 ? leg.profit / estimatedMinutes : leg.profit
    };
  }

  return routes.map((route) => {
    if (route.mode === "circular") {
      const legs = route.legs.map(enrichLeg);
      const estimatedMinutes = legs.reduce((sum, leg) => sum + (leg.estimatedMinutes || 0), 0);
      return {
        ...route,
        legs,
        estimatedMinutes,
        profitPerMinute: estimatedMinutes > 0 ? route.profit / estimatedMinutes : route.profit
      };
    }

    return enrichLeg(route);
  });
}

export function diversifyRoutes(routes, maxPerCommodity = 2, limit = 24) {
  const perCommodity = new Map();
  const primary = [];
  const overflow = [];

  for (const route of routes) {
    const count = perCommodity.get(route.commodityName) ?? 0;
    if (count < maxPerCommodity) {
      primary.push(route);
      perCommodity.set(route.commodityName, count + 1);
    } else {
      overflow.push(route);
    }
  }

  return [...primary, ...overflow].slice(0, limit);
}
