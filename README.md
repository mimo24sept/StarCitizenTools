# Star Citizen Craft Tracker

Application locale pour suivre les blueprints et les crafts de Star Citizen avec base SQLite embarquee.

## Fonctions

- base locale versionnee
- synchronisation depuis `sc-craft.tools`
- recherche et filtres par blueprint, categorie et materiau
- fiche detaillee d'un blueprint
- gestion d'inventaire local des materiaux
- estimation de craftabilite selon quantite et qualite
- script de build `.exe`

## Lancer

```bat
launch.bat
```

ou

```bat
py app.py
```

## Import complet de la base

```bat
py sync_all.py
```

## Construire un `.exe`

```bat
build_exe.bat
```

Le script essaie d'installer `pip` puis `pyinstaller` si besoin.

## Notes

- L'application fonctionne localement apres synchronisation.
- La synchro est volontairement lente et resiliente pour limiter les erreurs de l'API distante.
- La source principale de reference detectee est `https://sc-craft.tools/`.
