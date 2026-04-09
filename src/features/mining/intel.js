export const MINING_SHIP_PROFILES = {
  "MISC Prospector": {
    key: "prospector",
    type: "Ship mining",
    headSize: "1",
    headCount: 1,
    moduleSlots: 3,
    notes: "Solo ship miner. Great for focused fracture/extraction builds."
  },
  "Argo MOLE": {
    key: "mole",
    type: "Multi-crew ship mining",
    headSize: "2",
    headCount: 3,
    moduleSlots: 3,
    notes: "Crew mining ship. Stronger head options and better for larger rocks."
  },
  "Greycat ROC": {
    key: "roc",
    type: "Ground gem mining",
    headSize: "",
    headCount: 1,
    moduleSlots: 0,
    notes: "Best for gem mining on moons. Focus on Hadanite, Aphorite and Dolivine."
  },
  "Greycat ROC-DS": {
    key: "rocds",
    type: "Ground gem mining",
    headSize: "",
    headCount: 1,
    moduleSlots: 0,
    notes: "Two-seat ROC variant. Same general gem hunting loop."
  },
  "RSI Arrastra": {
    key: "arrastra",
    type: "Industrial ship mining",
    headSize: "3",
    headCount: 2,
    moduleSlots: 3,
    notes: "Heavy industrial platform for larger scale extraction."
  },
  "RSI Orion": {
    key: "orion",
    type: "Capital mining",
    headSize: "4",
    headCount: 4,
    moduleSlots: 4,
    notes: "Capital-scale mining. Use as a planning/reference profile for now."
  }
};

export const MINERAL_INTEL = {
  Quantainium: {
    confidence: "confirmed",
    tier: "High value",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "Aaron Halo", "Lyria", "Aberdeen"],
    notes: "Top value but volatile. Start around HUR-L1 if you want a fast, reliable asteroid loop and nearby refinery access."
  },
  Bexalite: {
    confidence: "confirmed",
    tier: "High value",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "HUR-L4 Melodic Fields asteroids", "Yela asteroid belt", "Lyria"],
    notes: "Excellent premium ore. HUR-L1 and HUR-L4 are strong asteroid starts when you want Bexalite without hard-committing to Quantainium."
  },
  Taranite: {
    confidence: "confirmed",
    tier: "High value",
    miningType: "Ship",
    bestSpot: "HUR-L4 Melodic Fields Station asteroids",
    search: ["HUR-L4 Melodic Fields Station asteroids", "HUR-L3 Thundering Express asteroids", "Arial", "Aberdeen"],
    notes: "Reliable high-value ore. HUR-L4 and HUR-L3 are strong asteroid choices when you want Taranite in a repeatable loop."
  },
  Agricium: {
    confidence: "confirmed",
    tier: "Good value",
    miningType: "Ship",
    bestSpot: "HUR-L3 Thundering Express Station asteroids",
    search: ["HUR-L3 Thundering Express Station asteroids", "Lyria", "Wala", "Daymar"],
    notes: "Strong mid/high-value target. HUR-L3 is a very efficient asteroid option thanks to the high Agricium presence nearby."
  },
  Hephaestanite: {
    confidence: "confirmed",
    tier: "Good value",
    miningType: "Ship",
    bestSpot: "HUR-L5 High Course Station asteroids",
    search: ["HUR-L5 High Course Station asteroids", "HUR-L4 Melodic Fields Station asteroids", "Daymar", "Arial"],
    notes: "A good filler ore. HUR-L5 is a comfortable first stop if you want steady Hephaestanite in asteroid belts."
  },
  Borase: {
    confidence: "confirmed",
    tier: "Medium value",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "Lyria", "Wala", "Magda"],
    notes: "Mostly a mixed-load ore. HUR-L1 works well when you want Borase in the same field as stronger materials."
  },
  Gold: {
    confidence: "confirmed",
    tier: "Medium value",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "HUR-L5 High Course Station asteroids", "Arial", "Daymar"],
    notes: "Simple, stable ore. HUR-L1 is a strong asteroid start if you want Gold mixed with higher-value rocks."
  },
  Diamond: {
    confidence: "confirmed",
    tier: "Medium value",
    miningType: "Ship",
    search: ["Wala", "Daymar", "Cellin"],
    notes: "Consistent and easy to keep when premium rocks are scarce."
  },
  Beryl: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "Daymar", "Yela", "Aberdeen"],
    notes: "Common ore, useful when building mixed loads."
  },
  Quartz: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L5 High Course Station asteroids",
    search: ["HUR-L5 High Course Station asteroids", "Cellin", "Daymar", "Arial"],
    notes: "Common and easy to find, but lower return."
  },
  Corundum: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L5 High Course Station asteroids",
    search: ["HUR-L5 High Course Station asteroids", "Aberdeen", "Magda", "Wala"],
    notes: "Frequent low-value ore. Usually only worth keeping in mixed cargo."
  },
  Aluminum: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "Aberdeen", "Daymar", "Lyria"],
    notes: "Very common. Usually low priority."
  },
  Tungsten: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L5 High Course Station asteroids",
    search: ["HUR-L5 High Course Station asteroids", "Magda", "Daymar", "Wala"],
    notes: "Common filler material. Often discarded for better rocks."
  },
  Copper: {
    confidence: "confirmed",
    tier: "Entry / filler",
    miningType: "Ship",
    bestSpot: "HUR-L1 Green Glade Station asteroids",
    search: ["HUR-L1 Green Glade Station asteroids", "Cellin", "Yela", "Daymar"],
    notes: "Low-value filler ore."
  },
  Hadanite: {
    confidence: "confirmed",
    tier: "Gem",
    miningType: "ROC / hand",
    bestSpot: "Arial",
    search: ["Arial", "Aberdeen", "Daymar"],
    notes: "Top ROC gem target. Start on Arial if you want the most straightforward gem run."
  },
  Aphorite: {
    confidence: "confirmed",
    tier: "Gem",
    miningType: "ROC / hand",
    bestSpot: "Aberdeen",
    search: ["Aberdeen", "Arial", "Wala"],
    notes: "Good ROC gem when Hadanite is scarce."
  },
  Dolivine: {
    confidence: "confirmed",
    tier: "Gem",
    miningType: "ROC / hand",
    bestSpot: "Daymar",
    search: ["Daymar", "Aberdeen", "Magda"],
    notes: "Lower priority ROC gem, but still useful."
  },
  Stileron: {
    confidence: "likely",
    tier: "Wikelo mineral",
    miningType: "Ship",
    bestSpot: "",
    search: ["Pyro / Terminus", "Pyro / Bloom"],
    notes: "Community reports point mostly to Pyro, especially around Terminus and Bloom, but a solid public mining source is still missing."
  },
  "Stileron (Raw)": {
    confidence: "likely",
    tier: "Wikelo mineral",
    miningType: "Ship",
    bestSpot: "",
    search: ["Pyro / Terminus", "Pyro / Bloom"],
    notes: "Use the sell data from the refined Stileron entry until a proper raw mining source is confirmed."
  }
};
