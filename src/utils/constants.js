export const PAGE_VISUALS = {
  crafting: [
    { kicker: "Blueprint Matrix", title: "Crafting", subtitle: "Track owned blueprints, preview quality effects, and see what your inventory can actually build." },
    { kicker: "Forge Deck", title: "Crafting", subtitle: "Readable crafting flow from mission source to material quality and final outcome." }
  ],
  trade: [
    { kicker: "C2 Hercules", title: "Trade Routes", subtitle: "Plan efficient cargo loops, visualize the route, and stage a clean overlay path." },
    { kicker: "Caterpillar Lane", title: "Trade Routes", subtitle: "Create routes fast, tune for budget and comfort, and keep them saved locally." }
  ],
  mining: [
    { kicker: "Prospector Deck", title: "Mining", subtitle: "Check ship mining setups, browse heads and modules, and figure out where each mineral is worth searching." },
    { kicker: "Extraction Grid", title: "Mining", subtitle: "A practical mining companion for ships, rocks, minerals and sell value." }
  ],
  wikelo: [
    { kicker: "Wikelo Intel", title: "Wikelo", subtitle: "Track rare resources, remember how to obtain them, and keep progress between sessions." },
    { kicker: "Rare Material", title: "Wikelo", subtitle: "A practical farming memory layer for the hard-to-find things you never want to lose track of." }
  ]
};

export const TRADE_NODES = {
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

export const TRADE_SYSTEM_NODES = {
  Stanton: [120, 190],
  Pyro: [350, 108],
  Nyx: [590, 196],
  Terra: [690, 86]
};

export const TRADE_MAP_SYSTEMS = {
  Stanton: {
    label: "Stanton",
    orbits: [
      { cx: 164, cy: 188, rx: 58, ry: 42 },
      { cx: 164, cy: 188, rx: 104, ry: 82 },
      { cx: 164, cy: 188, rx: 146, ry: 122 }
    ],
    nodes: {
      "Stanton Star": { x: 164, y: 188, type: "star", label: "Stanton", labelDy: -16 },
      Crusader: { x: 74, y: 114, type: "planet", label: "Crusader", major: true, labelDy: -18 },
      Cellin: { x: 40, y: 96, type: "moon", label: "Cellin" },
      Daymar: { x: 56, y: 144, type: "moon", label: "Daymar" },
      Yela: { x: 98, y: 146, type: "moon", label: "Yela" },
      Orison: { x: 42, y: 122, type: "station", label: "Orison", major: true, labelDx: -10, labelDy: -14, labelAnchor: "end" },
      "Seraphim Station": { x: 98, y: 146, type: "station", label: "Seraphim", major: true, labelDx: -6, labelDy: 18 },
      "Grim HEX": { x: 118, y: 132, type: "station", label: "Grim HEX" },
      ArcCorp: { x: 64, y: 324, type: "planet", label: "ArcCorp", major: true, labelDx: 34, labelDy: 10, labelAnchor: "start" },
      Wala: { x: 30, y: 290, type: "moon", label: "Wala" },
      Lyria: { x: 112, y: 350, type: "moon", label: "Lyria" },
      Area18: { x: 70, y: 352, type: "landing", label: "Area18", major: true, labelDx: -6, labelDy: 18 },
      "Baijini Point": { x: 106, y: 316, type: "station", label: "Baijini", major: true, labelDx: -8, labelDy: -14 },
      Hurston: { x: 196, y: 264, type: "planet", label: "Hurston", major: true, labelDx: 34, labelDy: 4, labelAnchor: "start" },
      Aberdeen: { x: 232, y: 236, type: "moon", label: "Aberdeen" },
      Arial: { x: 246, y: 286, type: "moon", label: "Arial" },
      Magda: { x: 162, y: 320, type: "moon", label: "Magda" },
      Ita: { x: 140, y: 238, type: "moon", label: "Ita" },
      Lorville: { x: 194, y: 306, type: "landing", label: "Lorville", major: true, labelDy: 18 },
      "Everus Harbor": { x: 152, y: 246, type: "station", label: "Everus", major: true, labelDx: -10, labelDy: -14 },
      microTech: { x: 266, y: 94, type: "planet", label: "microTech", major: true, labelDy: 32 },
      Calliope: { x: 226, y: 46, type: "moon", label: "Calliope" },
      Clio: { x: 294, y: 44, type: "moon", label: "Clio" },
      Euterpe: { x: 292, y: 148, type: "moon", label: "Euterpe" },
      "New Babbage": { x: 228, y: 102, type: "landing", label: "New Babbage", major: true, labelDx: -8, labelDy: -18 },
      "Port Tressler": { x: 308, y: 110, type: "station", label: "Tressler", major: true, labelDx: 18, labelDy: 2, labelAnchor: "start" },
      "Pyro Gateway (Stanton)": { x: 298, y: 184, type: "gateway", label: "Pyro Gateway", major: true, labelDx: -12, labelDy: -16 }
    }
  },
  Pyro: {
    label: "Pyro",
    orbits: [
      { cx: 164, cy: 186, rx: 34, ry: 28 },
      { cx: 164, cy: 186, rx: 58, ry: 48 },
      { cx: 164, cy: 186, rx: 88, ry: 72 },
      { cx: 164, cy: 186, rx: 124, ry: 104 },
      { cx: 164, cy: 186, rx: 158, ry: 150 }
    ],
    nodes: {
      "Pyro Star": { x: 164, y: 186, type: "star", label: "Pyro", labelDy: -16 },
      "Pyro I": { x: 116, y: 190, type: "planet", label: "Pyro I", major: true, labelDx: -12, labelDy: 26 },
      Bloom: { x: 118, y: 132, type: "planet", label: "Bloom", major: true, labelDx: -28, labelDy: -2, labelAnchor: "end" },
      Orbituary: { x: 76, y: 134, type: "station", label: "Orbituary", major: true, labelDx: -12, labelDy: -12, labelAnchor: "end" },
      "Starlight Service": { x: 150, y: 106, type: "station", label: "Starlight", major: true, labelDx: 0, labelDy: -16 },
      Monox: { x: 196, y: 230, type: "planet", label: "Monox", major: true, labelDx: 0, labelDy: 30 },
      Checkmate: { x: 224, y: 176, type: "station", label: "Checkmate", major: true, labelDx: 12, labelDy: -16, labelAnchor: "start" },
      "Patch City": { x: 238, y: 244, type: "station", label: "Patch City", major: true, labelDx: 12, labelDy: 16, labelAnchor: "start" },
      "Pyro IV": { x: 154, y: 312, type: "planet", label: "Pyro IV", major: true, labelDx: -12, labelDy: 28 },
      "Pyro V": { x: 158, y: 348, type: "planet", label: "Pyro V", major: true, labelDx: -4, labelDy: 30 },
      Gaslight: { x: 178, y: 380, type: "station", label: "Gaslight", major: true, labelDx: 10, labelDy: 18, labelAnchor: "start" },
      Ignis: { x: 120, y: 354, type: "moon", label: "Ignis" },
      Vatra: { x: 136, y: 338, type: "moon", label: "Vatra" },
      Adir: { x: 146, y: 326, type: "moon", label: "Adir" },
      Fairo: { x: 196, y: 328, type: "moon", label: "Fairo" },
      Fuego: { x: 208, y: 344, type: "moon", label: "Fuego" },
      Vuur: { x: 198, y: 362, type: "moon", label: "Vuur" },
      Terminus: { x: 34, y: 124, type: "planet", label: "Terminus", major: true, labelDx: -10, labelDy: -16, labelAnchor: "end" },
      "Ruin Station": { x: 70, y: 122, type: "station", label: "Ruin", major: true, labelDx: -8, labelDy: -16, labelAnchor: "end" },
      "Rat's Nest": { x: 42, y: 238, type: "station", label: "Rat's Nest", major: true, labelDx: -16, labelDy: 4, labelAnchor: "end" },
      "Dudley & Daughters": { x: 26, y: 320, type: "station", label: "Dudley", major: true, labelDx: -16, labelDy: 4, labelAnchor: "end" },
      "Rod's Fuel": { x: 280, y: 252, type: "station", label: "Rod's Fuel", major: true, labelDx: 16, labelDy: 4, labelAnchor: "start" },
      Endgame: { x: 292, y: 340, type: "station", label: "Endgame", major: true, labelDx: 16, labelDy: 10, labelAnchor: "start" },
      "Stanton Gateway (Pyro)": { x: 252, y: 100, type: "gateway", label: "Stanton Gateway", major: true, labelDx: 16, labelDy: -14, labelAnchor: "start" },
      "Nyx Gateway (Pyro)": { x: 304, y: 90, type: "gateway", label: "Nyx Gateway", major: true, labelDx: 18, labelDy: -14, labelAnchor: "start" }
    }
  },
  Nyx: {
    label: "Nyx",
    orbits: [
      { cx: 164, cy: 186, rx: 74, ry: 58 }
    ],
    nodes: {
      "Nyx Star": { x: 164, y: 186, type: "star", label: "Nyx", labelDy: -16 },
      Delamar: { x: 116, y: 204, type: "asteroid", label: "Delamar", major: true, labelDx: 0, labelDy: 22 },
      Levski: { x: 116, y: 170, type: "landing", label: "Levski", major: true, labelDx: 0, labelDy: -16 },
      "Glaciem Ring": { x: 220, y: 108, type: "belt", label: "Glaciem Ring" },
      "Pyro Gateway (Nyx)": { x: 286, y: 186, type: "gateway", label: "Pyro Gateway", major: true, labelDx: -12, labelDy: -16 }
    }
  }
};

export const TRADE_MAP_CONNECTIONS = {
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

export const CARGO_SHIPS = ["C2 Hercules", "M2 Hercules", "Caterpillar", "Mercury Star Runner", "Freelancer MAX", "Hull A"];

export const COMBAT_SHIPS = ["Arrow", "Gladius", "Hawk", "Talon", "Hornet Mk II", "Sabre", "Scorpius"];

export const LOADOUT_SLOTS = ["Power", "Cooler", "Shield", "Quantum", "Weapons", "Missiles", "Utility"];
