# Star Citizen Companion

Application desktop locale pour `Star Citizen`, pensée comme un hub visuel et pratique pour :
- le `crafting`
- les `trade routes`
- les `loadouts`
- le suivi de ressources

L’objectif du projet est simple : éviter les allers-retours permanents entre plusieurs sites et proposer une expérience plus lisible, plus rapide, et utilisable directement en jeu avec un overlay léger.

## Aperçu

Ce projet tourne en :
- `Electron`
- `React`
- `Vite`
- `SQLite / snapshots locaux`

Les données restent locales une fois importées, et l’application peut ensuite être utilisée hors ligne pour la consultation.

## Modules actuels

### Crafting
- navigation dans la base de blueprints
- suivi des blueprints possédés
- détail des matériaux par segment
- qualité des matériaux et impact sur les stats
- filtres mission / type / location

### Trade Routes
- calculateur de routes à partir des données `UEX`
- filtre par vaisseau, budget, terminal d’origine, système cible
- sélection de commodities à privilégier
- exclusion de commodities à éviter
- route sélectionnée avec détail profit / prix / marge
- overlay minimal pour suivre les étapes sans alt-tab

### Loadouts
- base de notes locale pour les fittings
- sauvegarde de presets
- suivi des composants et de leur provenance

### Wikelo
- suivi local de ressources rares
- notes et progression entre sessions

## Overlay trade

L’application inclut un overlay minimal pour les routes commerciales :
- toujours au-dessus du jeu
- déplaçable
- redimensionnable
- progression manuelle par étapes

Le design actuel est volontairement simple :
- une colonne de points reliés
- une étape par point
- progression visuelle claire

## Lancer le projet

### Développement

```bat
cmd /c npm.cmd run start
```

### Mode web de dev

```bat
cmd /c npm.cmd run dev:web
cmd /c npm.cmd run dev
```

## Synchroniser les données trade

La page `Trade Routes` peut récupérer une snapshot locale depuis `UEX`.

Les données actuellement exploitées incluent :
- véhicules cargo
- terminaux
- commodities
- prix d’achat / revente

## Construire un `.exe`

### Build portable Windows

```bat
cmd /c npm.cmd run dist:win
```

Le build sera généré dans :

```text
release/
```

Le fichier cible attendu est un exécutable portable du type :

```text
StarCitizenCompanion-0.1.0.exe
```

### Build dossier non packagé

```bat
cmd /c npm.cmd run dist:dir
```

## Release GitHub

Oui, le workflow prévu est :
1. construire le `.exe`
2. pousser le code sur GitHub
3. créer une `GitHub Release`
4. joindre le fichier `.exe` dans les assets

Comme ça, les gens téléchargent directement l’exécutable depuis la page `Releases`, sans avoir à installer Node, Python, ou cloner le repo.

## État du projet

Le projet est encore en évolution active.  
La direction actuelle est :
- une DA rétro-futuriste plus forte
- une meilleure ergonomie générale
- un vrai hub local Star Citizen
- des outils plus lisibles que les dashboards techniques classiques

## Roadmap courte

- améliorer encore la DA globale
- raffiner la page `Trade Routes`
- enrichir l’overlay
- pousser les `Loadouts` vers un vrai module type Erkul
- améliorer la couche Wikelo / ressources rares

## Notes

- application non officielle
- données issues de sources communautaires/publiques
- les prix et profits peuvent varier selon l’état des serveurs et du backend du jeu

## Auteur

Projet maintenu pour construire un companion app local, lisible et immersif pour la communauté `Star Citizen`.
