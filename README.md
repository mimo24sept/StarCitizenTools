<div align="center">

# Star Citizen Companion

### A local desktop hub for crafting, trade routes, and Wikelo progression

<p>
  <img src="https://img.shields.io/badge/Windows-Portable-0b0b0b?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Portable" />
  <img src="https://img.shields.io/badge/Electron-41.x-0b0b0b?style=for-the-badge&logo=electron&logoColor=61dafb" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19.x-0b0b0b?style=for-the-badge&logo=react&logoColor=61dafb" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5.x-0b0b0b?style=for-the-badge&logo=vite&logoColor=ffd62e" alt="Vite" />
  <img src="https://img.shields.io/badge/Data-Local%20Snapshots-0b0b0b?style=for-the-badge&logo=json&logoColor=00d7ff" alt="Local Snapshots" />
  <img src="https://img.shields.io/badge/Version-v0.2.0-0b0b0b?style=for-the-badge&logo=github&logoColor=00d7ff" alt="Version 0.2.0" />
</p>

<p>
  <img src="https://media0.giphy.com/media/2PmCBT0UGX0Zxe4nF5/100.gif" alt="Star Citizen animated banner" width="720" />
</p>

<p>
  Built to keep the most useful Star Citizen tools in one local app:
  <strong>blueprints</strong>, <strong>trade planning</strong>, and <strong>Wikelo recipes</strong>,
  without juggling multiple tabs every session.
</p>

</div>

---

## What It Does

Star Citizen Companion is a local Electron desktop app designed to turn community data into a cleaner in-game planning workflow.

It focuses on three things:

- `Crafting`: browse blueprints, track owned blueprints, inspect material quality, and preview stat modifiers.
- `Trade Routes`: calculate profitable routes from local UEX snapshots, compare simple and circular loops, estimate profitability over time, and display route guidance.
- `Wikelo`: browse recipes, track progress, build shopping lists, and enrich materials with Star Citizen Wiki and UEX data.

Once synchronized, the app is designed to remain usable locally.

---

## Highlights

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>Crafting</h3>
      <ul>
        <li>Full blueprint library</li>
        <li>Owned blueprint tracking</li>
        <li>Per-segment material quality</li>
        <li>Stat modifier preview</li>
        <li>Mission / type / location filters</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>Trade Routes</h3>
      <ul>
        <li>UEX-based local route calculator</li>
        <li>Simple and circular routes</li>
        <li>Estimated profitability over time</li>
        <li>Navigation map view</li>
        <li>Minimal trade overlay</li>
      </ul>
    </td>
    <td width="33%" valign="top">
      <h3>Wikelo</h3>
      <ul>
        <li>Complete recipe browser</li>
        <li>Tracked progression per recipe</li>
        <li>Inventory + shopping list</li>
        <li>Wiki-enriched material intel</li>
        <li>UEX cross-reference when available</li>
      </ul>
    </td>
  </tr>
</table>

---

## Built Around Local Data

The app uses community and public sources, then stores synchronized data locally.

### Current data sources

- `SC Craft Tools` for crafting / blueprint data
- `UEX` for terminals, commodities, prices, routes, and trade distances
- `SeekND/Wikelo` for Wikelo recipes
- `Star Citizen Wiki` for Wikelo enrichment, images, and item intel

### Local storage

Synchronized data is stored in:

- `data/craft_tracker.db`
- `data/trade_snapshot.json`
- `data/trade_distance_cache.json`
- `data/wikelo_snapshot.json`

---

## Preview Vibe

<div align="center">
  <img src="https://media1.giphy.com/media/AC0OhJdzZxak0XtFtC/100.gif" alt="Star Citizen race gif" width="360" />
  <img src="https://media4.giphy.com/media/gOFcKkrNqKBENOPu81/200.gif" alt="Star Citizen floating gif" width="360" />
</div>

---

## Running The Project

### Install dependencies

```bat
cmd /c npm.cmd install
```

### Launch the desktop app

```bat
cmd /c npm.cmd run start
```

### Run Vite in dev mode

```bat
cmd /c npm.cmd run dev:web
cmd /c npm.cmd run dev
```

---

## Build The Windows EXE

### Portable build

```bat
cmd /c npm.cmd run dist:win
```

Output:

```text
release/StarCitizenCompanion-0.2.0.exe
```

### Unpacked directory build

```bat
cmd /c npm.cmd run dist:dir
```

---

## GitHub Release Workflow

1. Build the `.exe`
2. Push the code to GitHub
3. Create a new GitHub Release
4. Upload the `.exe` in the release assets

Important:

- GitHub's automatic `.zip` is the source code archive
- the Windows executable must be uploaded manually as a release asset

---

## Project Status

This project is under active iteration.

Current focus:

- improving visual stability and layout polish
- refining the trade route experience
- improving the Wikelo detail view and material intelligence
- keeping the application fully local-first after sync

---

## Notes

- unofficial application
- relies on public and community-maintained sources
- some prices, routes, and item details may change with patches
- route profitability is still an estimate based on available data

---

## Credits

- `Star Citizen / RSI` for the game universe
- `SC Craft Tools`
- `UEX`
- `SeekND/Wikelo`
- `Star Citizen Wiki`

Animated media in this README comes from the official `Star Citizen` GIPHY account.
