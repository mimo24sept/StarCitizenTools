import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const srcDir = path.join(__dirname, 'src');
  const appFile = path.join(srcDir, 'App.jsx');
  const appSource = fs.readFileSync(appFile, 'utf8');

  function extractFunction(source, funcName) {
    const startStr = "function " + funcName + "(";
    const startIndex = source.indexOf(startStr);
    if (startIndex === -1) throw new Error("Could not find " + funcName);
    let openCount = 0;
    let started = false;
    for (let i = startIndex; i < source.length; i++) {
        if (source[i] === '{') {
            openCount++;
            started = true;
        } else if (source[i] === '}') {
            openCount--;
            if (started && openCount === 0) {
                return source.substring(startIndex, i + 1);
            }
        }
    }
    return null;
  }

  ['pages', 'components', 'utils'].forEach(dir => {
    fs.mkdirSync(path.join(srcDir, dir), { recursive: true });
  });

  const constantsEnd = appSource.indexOf('function toNumber');
  const constantsSection = appSource.substring(0, constantsEnd);
  let constantsJs = "export const PAGE_VISUALS = " + (constantsSection.match(/const PAGE_VISUALS = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const TRADE_NODES = " + (constantsSection.match(/const TRADE_NODES = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const TRADE_SYSTEM_NODES = " + (constantsSection.match(/const TRADE_SYSTEM_NODES = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const TRADE_MAP_SYSTEMS = " + (constantsSection.match(/const TRADE_MAP_SYSTEMS = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const TRADE_MAP_CONNECTIONS = " + (constantsSection.match(/const TRADE_MAP_CONNECTIONS = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const CARGO_SHIPS = " + (constantsSection.match(/const CARGO_SHIPS = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const COMBAT_SHIPS = " + (constantsSection.match(/const COMBAT_SHIPS = ([\s\S]*?);/)[1]) + ";\n\n";
  constantsJs += "export const LOADOUT_SLOTS = " + (constantsSection.match(/const LOADOUT_SLOTS = ([\s\S]*?);/)[1]) + ";\n";
  fs.writeFileSync(path.join(srcDir, 'utils', 'constants.js'), constantsJs);

  const utilsStart = appSource.indexOf('function toNumber');
  const utilsEnd = appSource.indexOf('function SectionCard');
  let utilsRegexMatch = appSource.substring(utilsStart, utilsEnd);
  let utilsJs = utilsRegexMatch.replace(/function /g, 'export function ').trim() + '\n';
  fs.writeFileSync(path.join(srcDir, 'utils', 'helpers.js'), utilsJs);

  const secCard = extractFunction(appSource, 'SectionCard');
  fs.writeFileSync(path.join(srcDir, 'components', 'SectionCard.jsx'), "export default " + secCard + "\n");

  const routeMap = extractFunction(appSource, 'TradeRouteMap');
  fs.writeFileSync(path.join(srcDir, 'components', 'TradeRouteMap.jsx'), 
  "import { TRADE_MAP_SYSTEMS, TRADE_MAP_CONNECTIONS } from '../utils/constants';\n\nexport default " + routeMap + "\n");

  const hero = extractFunction(appSource, 'Hero');
  fs.writeFileSync(path.join(srcDir, 'components', 'Hero.jsx'), "export default " + hero + "\n");

  const pagesToExtract = ['TradePage', 'TradeRoutesPage', 'LoadoutsPage', 'WikeloPage'];
  for (const p of pagesToExtract) {
    const pCode = extractFunction(appSource, p);
    
    let imports = "import { useState, useEffect } from 'react';\n";
    imports += "import { toNumber, fmtMoney, fmtNumber } from '../utils/helpers';\n";
    imports += "import { TRADE_NODES, CARGO_SHIPS, COMBAT_SHIPS, LOADOUT_SLOTS } from '../utils/constants';\n";
    imports += "import SectionCard from '../components/SectionCard';\nimport Hero from '../components/Hero';\n";
    if (p === 'TradeRoutesPage') {
       imports += "import TradeRouteMap from '../components/TradeRouteMap';\n";
       imports += "import { calculateBestRoutes, calculateCircularRoutes, diversifyRoutes, getCargoShips, getSystems, getTerminalLabel, getTradeCommodities, getTradeTerminals, loadTradeSnapshot } from '../tradeData';\n";
    }
    
    fs.writeFileSync(path.join(srcDir, 'pages', p + '.jsx'), imports + "\nexport default " + pCode + "\n");
  }

  // Rewrite App.jsx to be thinner
  let appImports = "import { useDeferredValue, useEffect, useState } from 'react';\n";
  appImports += "import { createDbClient } from './dbClient';\n";
  appImports += "import { PAGE_VISUALS } from './utils/constants';\n";
  appImports += "import { fmtSeconds, toNumber, getIngredientQualityKey } from './utils/helpers';\n";
  appImports += "import SectionCard from './components/SectionCard';\n";
  appImports += "import Hero from './components/Hero';\n";
  appImports += "import TradePage from './pages/TradePage';\n";
  appImports += "import TradeRoutesPage from './pages/TradeRoutesPage';\n";
  appImports += "import LoadoutsPage from './pages/LoadoutsPage';\n";
  appImports += "import WikeloPage from './pages/WikeloPage';\n\n";

  const appStart = extractFunction(appSource, 'App');
  fs.writeFileSync(appFile, appImports + "export default " + appStart + "\n");

  console.log("Splitting finished.");
} catch (e) {
  console.error("FATAL ERROR");
  console.error(e.stack);
  process.exit(1);
}
