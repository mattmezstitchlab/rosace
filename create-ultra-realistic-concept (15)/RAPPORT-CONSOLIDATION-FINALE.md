# ROSACE — rapport unique de consolidation technique

> **Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.**

- **Date** : 3 novembre 2026
- **Branche** : `arena/538bb149-rosace`
- **Commit de base** : `245064f353fd74aa34a9ffd8c0fdcf07d996d12c`
- **Racine applicative** : `create-ultra-realistic-concept (15)/`
- **État** : consolidation terminée, tests exécutés, **aucun déploiement**, **aucun push**, **aucune publication** sans validation.

Ce document remplace et absorbe `ATLAS-INTEGRATION.md`, `DMC-SOURCES.md` et `LOT-2-RAPPORT.md`, supprimés du dépôt. Il est le **seul rapport** de l'arbre. Les informations encore utiles de ces trois documents — architecture, provenance DMC, protocole de validation terrain — sont reprises ci-dessous, corrigées lorsque le code avait évolué.

---

## 1. Résumé exécutif

L'application ROSACE est désormais organisée autour d'un **unique moteur géométrique** (`generateRosace` dans `src/lib/rosace.ts`), d'un **unique patron calculé** (`RosaceProvider`), d'un **unique rendu partagé** (`paintPattern`), d'une **unique empreinte** (`patternFingerprint`), d'un **unique service de progression/projet** (`src/lib/progress.ts` + `exportActions` du store) et d'un **unique jeu de tests** complété par un parcours navigateur réel.

**Aucun nouveau moteur n'a été créé.** Aucune fonction opérationnelle n'a été remplacée par une version moins complète : les manques constatés (brin 5, marge 0–50, journal, import, raccourcis) ont été **complétés** ou **centralisés**, pas retirés. Le design, la couronne chromatique de 489 fils et l'ergonomie mobile sont conservés ; les captures mobile et bureau produites par le parcours navigateur le confirment.

Résultats des validations finales :

| Commande | Résultat |
|---|---|
| `npm test` | **18 tests réussis.** |
| `npm run typecheck` | **exit 0** |
| `npm run build` | **✓ 2506 modules transformés**, `dist/index.html 744.39 kB │ gzip: 334.22 kB`, `✓ built in 3.45s` |
| `npm run test:browser` | **Parcours navigateur réussis** sous Chromium 153.0.8010.0, mobile 390×844 et bureau 1440×900 |

Le serveur Vite de test tourne sur `0.0.0.0:5173` avec `server.allowedHosts: true` et `preview.allowedHosts: true`, donc l'aperçu live est accessible ; il ne s'agit pas d'un déploiement.

---

## 2. Arbre réellement inspecté

### 2.1 Constat initial

Le dépôt fourni contenait **48 fichiers suivis**, environ **1,2 Mo**, et **une seule racine applicative**. L'historique Git est **greffé** : un seul commit (`245064f`) est disponible. Il n'existe donc **aucune branche, aucun commit antérieur et aucun diff historique** permettant de comparer plusieurs implémentations concurrentes. L'audit a porté sur les fichiers présents, leur contenu, leurs imports, leurs appels et leur exécution.

Éléments annoncés dans de précédents documents mais **absents de l'arbre** : `GridPanel.tsx`, `LOT-1-RAPPORT.md`, dossier `studio/motif5d`, sources « Point Zéro ». En revanche, `dist/index.html` était déjà présent ; il est désormais ignoré par Git, comme `node_modules/`.

### 2.2 Fichiers structurants après consolidation

| Fichier | Rôle canonique |
|---|---|
| `src/lib/rosace.ts` | `RosaceConfig`, `normalizeConfig`, `generateRosace`, `cells`/`stitches`, matériaux,usage, couleurs, liens de partage, `DIMENSION_NAMES`, `FABRIC_COLORS`, `SYMBOLS` |
| `src/lib/pattern-id.ts` | `patternFingerprint` : empreinte déterministe sur taille + matrice + palette |
| `src/lib/paint.ts` | `paintPattern(canvas, pattern, mode, resolution)` et `chartGeometry` : un seul rendu pour tambour, grille Broderie et exports PNG |
| `src/lib/chart.ts` | `chartRegions(size)` : découpage exact en 4 planches pour grilles impaires |
| `src/lib/materials.ts` | métrage aiguille/brins, échevettes, temps, Aïda, brins, marge |
| `src/lib/progress.ts` | stockage v2, validation, sérialisation, `buildProject`, `importProject`, `clampViewport`, `loadPatternProgress`, `emptyProgress` |
| `src/lib/exporters.ts` | PNG, SVG, CSV, PDF, téléchargement, attribution MakeBead |
| `src/data/dmc.ts` + `src/data/dmc-reference.json` | 489 références DMC, 161 historiques préservées, résolution de casse |
| `src/data/crown.ts` | `CROWN_THREADS` : couronne chromatique de 489 segments |
| `src/state/rosace-store.tsx` | **seul** `RosaceProvider`, un seul `pattern`, recette/favoris, historique, thème, catalogues, `exportActions` |
| `src/components/EmbroideryView.tsx` | mode Broderie, sans recalcul du patron |
| `src/components/Panels.tsx` | panneaux Forme / Couleurs / Réglages / Collection / Export |
| `src/components/Composer.tsx` | dock, raccourcis 1–6, garde lorsque Broderie est ouverte |
| `src/components/Disque.tsx` | couronne SVG de 489 segments |
| `src/components/RosaceCanvas.tsx`, `RosaceModule.tsx` | une seule coquille tambour + dock Broder |
| `tests/verify.ts` | 18 assertions Node/tsx, sans DOM |
| `tests/parcours-navigateur.ts` | parcours Playwright mobile + bureau |
| `vite.config.ts` | Vite singlefile, hôte `0.0.0.0`, hôtes de preview autorisés |
| `.gitignore` (racine dépôt) | ignore `node_modules/`, `dist/`, `.vite/`, logs, `.DS_Store`, `tests/artifacts/` |
| `RAPPORT-CONSOLIDATION-FINALE.md` | ce rapport |

`src/lib/useMediaQuery.ts`, inutilisé, a été supprimé. Les trois anciens rapports ont été supprimés. Aucun fichier `README.md` n'existait ; les commandes et limites sont documentées ici.

---

## 3. Chaîne de vérité unique

```
RosaceConfig (normalizeConfig)
        │
        ▼
generateRosace(config)  ───────────────►  pattern { config, size, cells, stitches, materials, ... }
        │                                      │
        │                                      ├─ RosaceProvider : UN SEUL pattern (useMemo)
        │                                      ├─ SavedCard : même generateRosace pour les vignettes
        │                                      ├─ paintPattern(..., "fabric" | "chart", ...)
        │                                      ├─ patternToSvg(...) / chartRegions(...)
        │                                      └─ calculate(pattern) / usage / matériaux
        ▼
patternFingerprint(pattern)
        │
        ▼
aime-rosace-progress-v2:<empreinte>  ──  loadPatternProgress / saveProgress / buildProject / importProject
```

Points vérifiés :

- `RosaceProvider` crée **un seul** `pattern` avec `useMemo(() => generateRosace(config), [config])`.
- `Dialogs.tsx` (`SavedCard`) appelle le **même** `generateRosace` pour les miniatures de la collection.
- `EmbroideryView` ne génère **jamais** de patron : il consomme `pattern` du provider.
- Tambour (`RosaceCanvas` → `paintPattern(..., "fabric")`) et grille Broderie (`paintPattern(..., "chart", 1800)`) parcourent les **mêmes** `pattern.stitches` et `pattern.cells`.
- `patternFingerprint` dépend de `size`, `cells` et `palette`, **pas** de la toile, du comptage Aïda, du nombre de brins ni de la marge.
- Les exports, le PDF, les liens de partage et les projets JSON dérivent tous du même `pattern`.

Le test 18 de `tests/verify.ts` compare les ensembles `x:y:color` tracés dans les deux modes via des stubs Canvas/Path2D ; le parcours navigateur compare également les 3 381 clés `x:y:DMC` relevées en direct dans Chromium. Les deux comparaisons sont strictes.

---

## 4. Fonctionnalités réellement intégrées

### 4.1Création du motif et réglages

- 6 curseurs de forme (`structure`, `trace`, `density`, `scale`, `twist`, `wave`), plus décalage de palette, symétrie, graines, modes courbe/herbier, etc.
- `GRID_SIZES = [81, 91, 101, 111, 121]`.
- 6 préréglages reproductibles ; la recette par défaut produit **101 × 101**, **3 381 croix**, empreinte **`353C357F12EC80D5`**.
- Miroir true, nettoyage des cellules 0, quatre régions `51×51`, `50×51`, `51×50`, `50×50`.
- Harmonies OKLCH, conversion CIEDE2000, audit de contraste, avertissements de fils proches.
- Annuler/Rétablir de recette, favoris, lien de partage `#r=`, thème Auto/Jour/Nuit.

### 4.2 Catalogue DMC et couronne

- **489 références DMC uniques** : 161 historiques intactes + 328 ajouts.
- `DMC_ALL_THREADS`, `THREAD_BY_CODE`, `THREAD_BY_UPPER_CODE`, `resolveThreadCode`, `getThread`.
- `resolveThreadCode` est insensible à la casse ; un code inconnu retourne `null` et n'invente aucune couleur.
- `normalizeConfig` canonicalise la palette et ignore les codes non résolus ; `getThread` a un repli d'affichage sûr.
- `CROWN_THREADS` réordonne les **489** fils ; `Disque.tsx` dessine 489 segments avec `CROWN_IN=402`, `CROWN_OUT=496`, `CROWN_SWEEP=344`.
- Anciennes recettes : les 161 codes historiques en minuscules sont résolus vers le code et l'hex canoniques.
- Source locale `src/data/dmc-reference.json` : `id=dmc-floss`, `brand=DMC`, `count=489`, `status=cross-checked`, licence **CC BY 4.0**, MakeBead, trois sources croisées. Le fichier amont `makebead/craft-color-codes` (`data/json/dmc-floss.json`, commit `85beca5`) a été consulté : mêmes métadonnées, 517 lignes, notes de réparation RGB/hex, correction DMC 309, distinction Blanc/B5200. Attribution portée par `src/data/dmc.ts`, `src/lib/exporters.ts` (métadonnées SVG et feuille de fournitures) et ce rapport.

> Attribution : *Color data: craft-color-codes by MakeBead*, <https://github.com/makebead/craft-color-codes>, <https://makebead.com/dmc-color-chart/>, licence **CC BY 4.0** ; code du dépôt amont MIT. Sources de données : `floss.maxxmint.com`, `adrianj/CrossStitchCreator`, `xstitchify.com`.

### 4.3 Tambour, loupe, zoom

- Tambour avec vis, toile Aïda, tension, 3 tons de lin, loupe.
- Loupe affiche désormais le **nombre de brins courant** (`config.strands`) au lieu d'un « 2 brins » figé.
- Zoom 80–800 %, ajustement à l'écran, molette + Ctrl, pavé tactile, raccourcis `+`, `-`, `0`, flèches, `Entrée`/`Espace`.
- Badge dynamique : croix, brins, taille, dimension, durée estimée.

### 4.4 Mode Broderie

- Grille 1800 px, repères 10/10, axes, numérotation, symboles par fil, couleur sélectionnée, filtres `Tout` / `Restants` / `Ce fil`.
- Marquage/démarquage d'une croix, **Annuler / Rétablir** : `Ctrl Z` annule, `Ctrl Y` et `Ctrl Maj Z` rétablissent ; remise à zéro avec confirmation.
- Progression séparée du patron, stockée sous `aime-rosace-progress-v2:<empreinte>`.
- Restants par fil, pourcentage, annonces pour lecteur d'écran, `aria-*`.
- Pincement à deux pointeurs, clavier sur le canvas, fermeture `Échap`, focus restauré.
- `progressRevision` dans le store force le rechargement après import, y compris à empreinte identique.

### 4.5 Calculs et fournitures

- Échevette 8 m / 6 brins ; 2,5 cm de fil aiguille pour 2 brins sur Aïda 14.
- `needleMeters` et `strandMeters` sont deux grandeurs distinctes.
- Marge 0–50 % par pas de 5, bornée et finie ; `NaN`/`Infinity` retombent sur 15 %.
- Brins **1 à 6**, y compris 5.
- Estimation 100–200 croix/h, donc une **plage** de temps, pas une vitesse irréaliste.
- Valeurs de la recette par défaut : 1 913 min (1 435 / 1 913 / 2 865), 97,3 m aiguille, 194,4 m de brins, 7 échevettes ; usage 902/3607/3608/907/677 = 1144/1028/796/72/341.

### 4.6 Exports, impression, projets

| Export | Contenu | Réimportable ? |
|---|---|---|
| PNG toile 1600×1600 | `paintPattern(..., "fabric")` | Non, export unidirectionnel |
| PNG grille | symboles + coordonnées | Non |
| SVG motif | croix vectorielles, métadonnées MakeBead | Non |
| SVG grille | patron symbolique complet | Non |
| CSV fournitures | couleurs, métrages, échevettes, ligne `Total` | Non |
| PDF fiche technique | 1 couverture + 4 planches A4 = **5 pages** | Non |
| Lien de partage `#r=` | recette exacte | Ouvre la recette, **pas** la progression |
| `.rosace.json` v2 | recette + progression + journal + vue | **Oui**, via `importProject` |

- `printWorksheet` utilise `chartRegions` : chaque croix apparaît exactement une fois sur les 4 planches.
- `patternToSvg` émet chaque symbole de croix exactement une fois.
- `buildProject` et `importProject` sont les seuls constructeurs/validateurs de projet : empreinte régénérée, cases vides rejetées, journal nettoyé, viewport borné, couleur sélectionnée validée.
- `exportActions.project` est le **seul** point d'export JSON, utilisé par le panneau Export et par Broderie. Le panneau relit une progression locale nettoyée ; Broderie fournit son instantané courant, journal compris.
- `exportActions.projectImport` est le **seul** point d'import, utilisé par les deux interfaces.

### 4.7 Persistance, design et ergonomie

- `aime-rosace-recette-v1`, `aime-rosace-favoris-v1`, `aime-rosace-theme-v1`, `aime-rosace-progress-v2:<empreinte>`.
- `normalizeConfig` rend les anciens liens acceptants : clés inconnues ignorées, couleurs non résolues écartées, marge bornée.
- Design inchangé : `tokens.css`, `atlas.css`, `fonts.css`, `instrument.css`, `dialogues.css`, `broder.css`.
- Mobile : dock 6 entrées, safe-area, `100dvh`, cibles ≥ 44 px ; breakpoints 420 / 899 / 900 px.
- Bureau : dock latéral 72 px, panneau 360 px, espace tambour conservé.
- Raccourcis 1–6, `C` pour le catalogue, `Échap` pour fermer, `Ctrl Z/Y` pour la recette hors Broderie.
- Captures finales : `mobile-atelier.png`, `mobile-broder.png`, `bureau-export.png` dans `/tmp/rosace-browser/artifacts` (artefacts hors dépôt). Couronne 489, motif, panneaux et dock conformes à l'existant.

---

## 5. Doublons supprimés, divergences et régressions corrigées

| Élément | État constaté | Correction | Vérification |
|---|---|---|---|
| Export/import projet JSON | Deux implémentations : `Panels.tsx` et `EmbroideryView.tsx` | Un seul service `exportActions.project` / `projectImport` dans `src/state/rosace-store.tsx` | Tests 10, 16, 17 ; navigateur : export des deux UIs, import des deux UIs, refus fichier invalide |
| Instantané de progression | `Panels` relisait le stockage, `EmbroideryView` utilisait son état vivant ; Broderie omettait le journal | `projectSnapshot()` complet + `loadPatternProgress()` canonique ; `buildProject` nettoie aussi | Test 17 ; navigateur : `projet-broder.json` = `projet-export.json` hors `updatedAt`, journal = 1 entrée |
| Validation des cases | `EmbroideryView` filtrait localement, `importProject` acceptait des cases vides | `isStitchIndex`, `loadPatternProgress`, `importProject`, `buildProject` partagent la même règle | Tests 16, 17 ; navigateur : import avec case vide refusé |
| Bornage de vue | `clampViewport` local min 0,8 ; `importProject` min 1 | `MIN_ZOOM=0,8`, `MAX_ZOOM=8`, `clampViewport` unique dans `src/lib/progress.ts` | Tests 16, 17 ; navigateur : zoom 125 % puis ajustement |
| Rechargement après import | Même empreinte → la vue ouverte ne se rechargeait pas | `progressRevision` + effet de chargement + fermeture Broderie | Navigateur : import depuis Broderie, puis réouverture avec 3 380 croix restantes |
| Conflit `Ctrl Z` | Le store interceptait l'annulation recette même en Broderie | Store ignore `Ctrl Z/Y` si `embroideryOpen` ; `EmbroideryView` gère `Ctrl Z/Y/Maj Z` avec `stopPropagation` | Navigateur : 1 → 0 → 1 → 0 → 1 → 0 → 1 croix, boutons et clavier, recette inchangée |
| Raccourcis dock derrière la modale | `1`–`6`, `C`, `Échap` pouvaient agir sous Broderie | `Composer` sort immédiatement si `embroideryOpen` ; dépendances complètes | Navigateur : `1`–`6`, `C`, catalogue, `Échap` |
| État actif du dock | Variable `isGrid` | `isBroder`, libellé « Broder » | Typecheck + navigateur |
| Noms des curseurs | `FORM_NAMES` recopiait 4 tableaux de `DIMENSION_NAMES` | `FORM_NAMES = { ...DIMENSION_NAMES, twist, wave }` | Typecheck |
| Brin 5 | `Réglages` proposait 1,2,3,4,6 et non 5 | 1–6 complets | Navigateur : sélection 5 brins puis restauration 2 |
| Marge | Champ borné 0–50 mais pas de curseur `.curseur` complet | Curseur `.curseur` 0–50 pas 5, valeur bornée côté moteur | Navigateur : 0 → 20 → 15 % |
| Loupe | « 2 brins » codé en dur | `config.strands` dynamique | Typecheck + navigateur |
| `useMediaQuery.ts` | Hook mort, aucun import | `git rm` | `git status`, typecheck |
| CSS mort | `.grille-*`, `.is-grid`, `.outils-*` hérités d'un `GridPanel`/panneau Outils absent | Blocs supprimés de `instrument.css` et `dialogues.css` | Script de classes + build |
| `Disque.tsx` | Commentaire « 161 fils », variable `middle` inutilisée | 489, `middle` retiré ; géométrie de couronne intacte | Typecheck + captures |
| Pincement | `ratio` calculé puis `void ratio` | Calcul mort retiré, comportement inchangé | Typecheck |
| Palette / liens anciens | Codes DMC en minuscules non résolus ; `wastePercent` NaN possible | `resolveThreadCode` insensible à la casse, `normalizeConfig` canonique, marge finie 0–50 | Tests 13, 14 ; navigateur : lien legacy |
| Attribution MakeBead | URL francisée/non canonique dans `exporters.ts` | `https://github.com/makebead/craft-color-codes` + CC BY 4.0 en anglais | Test 15 ; navigateur : SVG motif |
| Toast « Outils et Explorer » | Faisait référence à une UI absente | « catégorie Collection du dock » | Navigateur |
| Documentation | 3 rapports, dont `ATLAS-INTEGRATION.md` parlait encore de 161 fils, « Grille », `GridPanel`, « Point Zéro » | Un seul rapport consolidé | Ce fichier |
| Prévisualisation live | Vite liait `127.0.0.1`, hôte `*.e2b.app` rejeté en 403 | `server.host=0.0.0.0`, `server.allowedHosts=true`, idem `preview` | `start_process` sans avertissement, serveur sur `0.0.0.0:5173` |

**Doublons de moteurs : aucun.** Aucun fichier `GridPanel.tsx`, aucun second `generateRosace`, aucun second calcul de matériaux, aucun second store, aucun second validateur de projet, aucun second `paintPattern`.

---

## 6. Vérification des dix exigences

| # | Exigence | Résultat |
|---|---|---|
| 1 | Inspecter les fichiers réellement présents et leurs modifications | Arbre complet audité, `git status`/`git diff` relus, 48 fichiers initiaux, historique greffé documenté |
| 2 | Comparer Broderie, calculs, exports, persistance | Chaîne unique décrite en §3 ; tous les appels convergent vers `pattern`, `progress.ts`, `exportActions` |
| 3 | Identifier doublons, divergences, régressions | 18 corrections listées en §5 |
| 4 | Tambour et grille Broderie = même matrice | Test 18 (stubs Canvas) + trace navigateur : 3 381 clés `x:y:DMC` identiques |
| 5 | Progression séparée du patron, liée à l'empreinte | Clé `aime-rosace-progress-v2:<empreinte>` ; tests 6, 10, 16, 17 ; navigateur : 3 clés de stockage, empreinte absente de la recette, cookie de recette inchangé |
| 6 | 489 DMC accessibles sans casser les anciennes recettes | 489 uniques, 161 historiques, 328 ajouts, couronne 489, `resolveThreadCode` casse-insensible ; tests 1, 13, 14 ; navigateur : catalogue 489 avec recherche `B5200` |
| 7 | Exports cohérents et réimportables quand annoncé | PNG/SVG/CSV/PDF unidirectionnels ; projet JSON v2 seul réimportable, validé dans les deux UIs ; PDF 5 pages, SVG 3 381 symboles, CSV `Total`, PNG signés |
| 8 | Suite de tests présente, puis parcours navigateur | `npm test` 18/18, `typecheck`, `build`, puis `test:browser` mobile + bureau |
| 9 | Documenter résultats et limites | Ce rapport, §7, §8, §9 |
| 10 | Conserver design, couronne, ergonomie mobile | Aucun changement de tokens/breakpoints/géométrie de couronne ; captures conformes ; §4.7 |

---

## 7. Tests exécutés en détail

### 7.1 Suite Node/tsx — `npm test`

`tests/verify.ts` couvre : 489 références et 161 historiques, métrage aiguille/brins, conversions Aïda, plage de temps, déterminisme du moteur, empreinte hors toile/brins/marge, couverture exacte des 4 planches pour 81/91/101/111/121, 6 préréglages, sérialisation des runs, export/import par empreinte, restants par fil, non-régression des 6 curseurs, 328 ajouts + couronne 489, anciennes recettes en minuscules, symboles SVG uniques, journal/sélection/zoom/cases vides, export nettoyant une progression corrompue, **matrice unique tambour/grille**.

Sortie finale : `18 tests réussis.`

### 7.2 Typecheck — `npm run typecheck`

`tsc --noEmit`, `include: ["src", "tests", "vite.config.ts"]`, `strict`, `noUnusedLocals`, `noUnusedParameters` : **exit 0**. Le parcours navigateur est donc typé lui aussi.

### 7.3 Build — `npm run build`

Vite 7.3.2, 2 506 modules, singlefile, `dist/index.html 744.39 kB │ gzip: 334.22 kB`, **exit 0**. `dist/` est ignoré par Git.

### 7.4 Parcours navigateur — `npm run test:browser`

Environnement utilisé :

```bash
CHROMIUM_PATH=/tmp/chromium \
LD_LIBRARY_PATH=/tmp/rosace-browser/unpack/lib/lib \
FONTCONFIG_PATH=/tmp/rosace-browser/unpack/fonts \
ARTIFACT_DIR=/tmp/rosace-browser/artifacts \
BASE_URL=http://127.0.0.1:5173 \
npm run test:browser
```

`playwright-core@1.64.1` est une dépendance de développement, mais **ne fournit pas de binaire Chromium**. Le binaire utilisé provient d'une installation ad hoc `@sparticuz/chromium@153.0.0` dans `/tmp/rosace-browser`, avec bibliothèques AL2023, fonts et SwiftShader extraits ; Chromium **153.0.8010.0**. `apt-get` n'est pas utilisable dans le bac à sable (`Acquire (13: Permission denied)`), d'où cette installation externe. Le script reste exécutable avec n'importe quel Chromium compatible via `CHROMIUM_PATH` et `BROWSER_ARGS`.

Le script injecte son instrumentation Canvas sous forme de **chaîne** (`addInitScript(TRACE_SCRIPT)`) : la sérialisation d'une fonction transpilée par `tsx` introduit un helper `__name` indisponible dans la page, ce qui a été diagnostiqué et corrigé.

Parcours **mobile 390×844** :

1. Chargement, titre `Bonjour ROSACE`, tambour visible, 489 segments de couronne, stats `3 381 croix` / `5 fils` / `101 × 10…`.
2. Catalogue DMC : 489 références, recherche `B5200`, fermeture clavier, focus restauré.
3. Lien de partage `eyJzdHJ1Y3R1cmUi…`, copie presse-papiers, recette inchangée.
4. Réglages : Aïda 16, 5 brins, marge 0 → 20 → 15 % via `.curseur`, puis restauration 2 brins / 15 % et Aïda 14.
5. Téléchargements : `toile.png` (signature PNG + 1600×1600), `grille.png`, `motif.svg` (métadonnées MakeBead + 5 groupes de fils), `grille.svg` (3 381 symboles + `3381 croix`), `fils.csv` (ligne `Total` + en-tête), `fiche.pdf` (5 pages, `31 h 53`, `97,3 m`, DMC 902).
6. **Matrice réelle** : 3 381 symboles sur le canvas 1800 de la grille, 3 381 clés `x:y:DMC` déduites des segments `Path2D` du canvas 1200 du tambour, ensembles strictement identiques.
7. Broderie : 3 381 croix restantes, filtres, clic central → 3 380 restantes, boutons Annuler/Rétablir puis `Ctrl Z` / `Ctrl Maj Z` / `Ctrl Y`, zoom 125 % → 100 %, remise à zéro confirmée puis reprise d'une croix.
8. Re-clic central, `Projet` depuis Broderie, fermeture, rechargement, persistance, `Importer` depuis Broderie, réouverture : 3 380 restantes, bouton Annuler actif et bouton Rétablir désactivé, journal restauré.
9. Panneau Export : `Exporter le projet` identique au projet Broderie, `Importer un projet` depuis le panneau, fingerprint inchangé, journal = 1.
10. Lien legacy avec `breaking_angle`, `schemaVersion` et clé inconnue : signature 007, 902/3607, aucune casse.
11. Dock mobile : boutons 1–6, `C`, `Échap`, garde derrière Broderie.

Parcours **bureau 1440×900** :

- Dock latéral 72 px, panneau 360 px, tambour non masqué.
- Clic `6` → panneau Export, copie du lien, fermeture du panneau, ouverture de la Collection, fermeture.
- Raccourci clavier `6` → Export, changement d'harmonie → `Messages` de contraste, catalogue → fermeture.
- Capture `bureau-export.png`.

Artefacts : 10 fichiers, 7,8 Mo. Vérifications complémentaires : `/Type /Page` = 5 dans le PDF ; `projet-broder.json` et `projet-export.json` identiques hors `updatedAt`, `fingerprint=353C357F12EC80D5`, `version=2`, `journal=1`, `completedRuns=5100`.

Sortie : `Parcours navigateur réussis · /tmp/rosace-browser/artifacts`, **exit 0**.

---

## 8. Résultats chiffrés de l'audit runtime

- 161 historiques / 489 total / 328 ajouts ; `missingFromRef=[]` ; couronne 489.
- Défaut : 101×101, 3 381 croix, `353C357F12EC80D5`, miroir true, nettoyage 0.
- Régions : 51×51, 50×51, 51×50, 50×50.
- Préréglages : 3 381 / 5 193 / 2 781 / 5 395 / 4 297 / 6 405 croix.
- Matériaux : 1 913 min (1 435 / 1 913 / 2 865), 97,3 m aiguille, 194,4 m brins, 7 échevettes.
- Usage par défaut : 902=1144, 3607=1028, 3608=796, 907=72, 677=341.
- Stockage navigateur : `aime-rosace-recette-v1`, `aime-rosace-progress-v2:353C357F12EC80D5`, `aime-rosace-theme-v1` ; aucune clé de progression pour une autre empreinte.
- Classes CSS : 143 après nettoyage, **7 classes non référencées** restantes : `bouton-large`, `chapeau`, `filet`, `orbe`, `serif-it`, `titre-monumental`, `titre-serif`. Elles sont inoffensives et conservées par prudence, car elles appartiennent au vocabulaire de design historique.

---

## 9. Défauts et limites restants

1. **Historique Git greffé** : un seul commit, donc aucune comparaison archéologique de variantes « Grille », « Point Zéro » ou `studio/motif5d`. L'absence de ces sources est un fait d'arbre, pas une suppression de cette consolidation.
2. **Binaire navigateur non fourni** : `npm run test:browser` exige `CHROMIUM_PATH` et, dans ce bac à sable, `LD_LIBRARY_PATH` / `FONTCONFIG_PATH`. `playwright-core` est versionné, pas Chromium. Le parcours est reproductible mais dépend d'une installation externe.
3. **Couverture navigateur** : Chromium 153 headless uniquement, aux deux tailles 390×844 et 1440×900. Pas de Safari, Firefox, appareil réel, lecteur d'écran réel ni test multi-touch matériel. Le pincement à deux pointeurs n'est pas automatisé ; il combine translation et zoom, sans ancrage au point focal.
4. **Lien de partage** : volontairement limité à la recette. Il ne transporte **pas** la progression, conformément à la séparation patron/progression ; ce n'est pas un défaut d'export.
5. **Exports unidirectionnels** : PNG, SVG, CSV, PDF ne sont pas réimportables. Seul `.rosace.json` v2 est annoncé et vérifié comme réimportable.
6. **PDF** : généré via `window.print()` dans une nouvelle fenêtre ; le test vérifie le nombre de pages et le texte, pas le rendu d'impression papier réel. Les 4 planches sont calculées pour grilles impaires 81–121.
7. **DMC** : les 489 couleurs sont une table d'équivalence RVB documentée, pas une garantie de bain de teinture ni de rendu sous lumière naturelle. L'audit de contraste avertit, il ne corrige pas automatiquement la palette.
8. **Anciens liens** : un représentant legacy avec `breaking_angle`, `schemaVersion` et clé inconnue a été validé, pas une matrice exhaustive de toutes les clés historiques possibles.
9. **CSS** : 7 classes non référencées subsistent ; aucune n'affecte le rendu. Elles n'ont pas été supprimées pour ne pas risquer de retirer un vocabulaire de style encore utile à une variante de design.
10. **Aperçu live ≠ déploiement** : le serveur Vite est lancé en `0.0.0.0:5173` avec hôtes autorisés, uniquement pour validation. Aucune mise en production n'a été effectuée.
11. **Protocole terrain non exécuté** : l'ancien `LOT-2-RAPPORT.md` proposait une validation par 5 brodeuses sur 3 recettes, 30 minutes, critères lisibilité/comptage/métrage/export ; elle reste **à organiser**, aucun résultat humain n'est disponible dans ce dépôt. Les tests automatisés ne remplacent pas cette validation.

---

## 10. Protocole de validation terrain conservé (à exécuter)

| Étape | Action | Critère |
|---|---|---|
| 1 | Charger la recette 007 sur mobile et bureau | 3 381 croix, 489 fils visibles, aucun débordement |
| 2 | Ouvrir Broderie, cocher 20 croix, recharger | 20 croix conservées, empreinte identique |
| 3 | Changer uniquement Aïda / brins / marge | Progression conservée, empreinte inchangée |
| 4 | Changer la palette ou un curseur de forme | Nouvelle empreinte, nouvelle progression vierge |
| 5 | Exporter puis réimporter le projet depuis les deux UIs | Recette, croix, journal, zoom, fil sélectionné restaurés |
| 6 | Imprimer la fiche | 5 pages, chaque croix dans une seule planche, fournitures lisibles |
| 7 | Comparer 3 recettes avec 5 brodeuses, 30 min | Lisibilité des symboles, comptage, métrage perçu, fidélité des couleurs |

---

## 11. Commandes de reproduction

```bash
cd "create-ultra-realistic-concept (15)"
npm ci --no-audit --no-fund
npm test
npm run typecheck
npm run build
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort

# Dans un autre terminal, avec un Chromium externe :
CHROMIUM_PATH=/chemin/vers/chromium \
BASE_URL=http://127.0.0.1:5173 \
ARTIFACT_DIR=tests/artifacts \
npm run test:browser
```

`tests/artifacts/` est ignoré par Git. Les artefacts de cette session se trouvent dans `/tmp/rosace-browser/artifacts` et ne sont pas versionnés.

---

## 12. Conclusion

La consolidation est **terminée et vérifiée** sur l'arbre fourni : une seule application, un seul moteur, un seul patron, une seule empreinte, un seul service de progression/projet, un seul rapport. Les doublons d'E/S projet, les validateurs divergents, le CSS mort, le hook mort, les valeurs figées et la documentation périmée ont été supprimés ou corrigés. Les fonctionnalités opérationnelles ont été **préservées et complétées**, jamais appauvries. Les 18 tests unitaires, le typecheck strict, le build singlefile et les deux parcours navigateur passent. Le design, la couronne de 489 fils et l'ergonomie mobile sont intacts.

Conformément à la consigne, **rien n'a été déployé** et aucune publication n'a été faite sans validation. Les limites restantes sont documentées au §9 ; elles concernent l'environnement de test, la couverture navigateur et la validation humaine, pas la cohérence de l'application.

> **Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.**
