# Star Citizen Companion

Companion app desktop locale pour `Star Citizen`, pensée comme un hub simple et lisible pour consulter :
- le `crafting`
- les `trade routes`
- les `recettes Wikelo`

L'objectif est de regrouper plusieurs outils communautaires dans une seule application locale, avec synchronisation des données puis utilisation hors ligne.

## Stack

- `Electron`
- `React`
- `Vite`
- `sql.js`
- `snapshots JSON locaux`

## Modules actuels

### Crafting
- bibliothèque complète de blueprints
- recherche et filtres
- suivi des blueprints possédés
- qualité des matériaux
- aperçu des modificateurs par segment
- détails mission/type/location quand disponibles

### Trade Routes
- calculateur de routes à partir des données `UEX`
- filtre par vaisseau, budget, terminal d'origine, système cible
- sélection de commodities à privilégier ou exclure
- routes simples et circulaires
- estimation de rentabilité
- carte de navigation de la route
- overlay minimal pour suivre les étapes sans alt-tab

### Wikelo
- bibliothèque complète des recettes Wikelo
- recherche et filtres
- suivi de progression par recette
- inventaire local par ressource
- génération de liste de courses
- enrichissement `Star Citizen Wiki`
- croisement `UEX` quand un matériau existe aussi dans leurs données

## Sources de données

L'application s'appuie sur des sources publiques et communautaires :

- `SC Craft Tools` pour le crafting
- `UEX` pour les routes commerciales, terminaux, commodities et prix
- `SeekND/Wikelo` pour les recettes Wikelo
- `Star Citizen Wiki` pour l'enrichissement des objets, images et informations Wikelo

Les données sont synchronisées localement puis stockées dans le dossier `data/`.

## Utilisation

### Développement

```bat
cmd /c npm.cmd install
cmd /c npm.cmd run start
```

### Mode dev avec Vite

```bat
cmd /c npm.cmd run dev:web
cmd /c npm.cmd run dev
```

## Build Windows

### Exécutable portable

```bat
cmd /c npm.cmd run dist:win
```

Le build est généré dans :

```text
release/
```

Nom attendu :

```text
StarCitizenCompanion-0.2.0.exe
```

### Dossier non packagé

```bat
cmd /c npm.cmd run dist:dir
```

## GitHub Release

Workflow recommandé :

1. construire le `.exe`
2. pousser le code sur GitHub
3. créer une `GitHub Release`
4. ajouter le `.exe` dans les assets de la release

Le `.zip` proposé automatiquement par GitHub correspond au code source, pas au binaire Windows.

## État actuel

Le projet est encore en évolution active.

Priorités actuelles :
- améliorer la stabilité visuelle de certains écrans
- continuer à raffiner l'UX
- enrichir encore les données Wikelo et trade
- pousser l'aspect local/offline

## Notes

- application non officielle
- données issues de sources publiques et communautaires
- certaines informations dépendent de services tiers et peuvent évoluer avec les patches
- les profits et prix de trade restent des estimations basées sur les données disponibles

## Auteur

Projet maintenu comme companion app local et visuel pour la communauté `Star Citizen`.
