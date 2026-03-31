export const PAGE_VISUALS = {
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
