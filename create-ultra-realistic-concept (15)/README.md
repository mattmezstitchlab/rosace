# ROSACE

> Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.

ROSACE est un atelier de point de croix à écran fixe : une recette produit **un seul patron**, affiché dans le tambour, puis suivi dans le mode **Broder** jusqu'aux dernières croix. La géométrie, les couleurs, les calculs de fil, les exports et la progression partagent la même matrice.

L'application a deux entrées : une **présentation** (page d'accueil) qui montre le résultat, et l'**atelier** qui le fabrique.

## Concept

- Sept réglages de forme, dont **six familles géométriques**, cinq harmonies, 489 références DMC, couronne chromatique complète.
- Recette reproductible par signature et liens `#r=`.
- **Tambour** = vue textile ; **Broder** = vue technique de la même grille.
- Progression séparée du motif, indexée par empreinte du patron, jamais mélangée à la recette.
- Design, couronne chromatique et ergonomie mobile conservés.

## Présentation et atelier

| URL | Écran |
|---|---|
| `/` | présentation : « La géométrie devient broderie. » |
| `/#atelier` | atelier, panneau fermé |
| `/#atelier-forme`, `/#atelier-couleurs`, `/#atelier-reglages`, `/#atelier-export` | atelier avec le panneau correspondant ouvert |
| `/#atelier-broder` | atelier en mode broderie |
| `/#r=…` | atelier sur une recette partagée |

Les liens `#atelier…` sont remplacés dès l'ouverture par la recette courante (`#r=…`), pour que l'URL reste partageable. La marque, en haut de l'atelier, ramène à la présentation.

La présentation (`src/landing/`) ne raconte pas l'interface : elle montre des **patrons réels**, rendus par `generateRosace` + `paintPattern`, avec les mêmes chiffres que l'atelier (croix, centimètres, fils, durée). Le comparateur motif/grille recale la marge technique de la grille sur celle du rendu textile : les deux moitiés coïncident exactement au trait de comparaison.

L'en-tête porte le mot-symbole **ROSACE** en très grand, à la manière d'un masthead ; une barre fine prend le relais dès que l'on descend.

Le comparateur motif/grille se balaie à la main : on attrape le trait dans l'image (souris, doigt), ou on le déplace au clavier (flèches, `Maj` pour aller plus vite, `Début`/`Fin`). Le trait porte `role="slider"`, avec sa valeur annoncée en pourcentage de grille.

Fond blanc, sections alternées en gris très clair, deux temps sombres (la carte des exports, l'appel final). L'atelier est **mis en situation** dans des châssis d'ordinateur, de tablette et de téléphone (`src/landing/devices.tsx`) : chaque écran est composé avec le moteur du produit — la même rosace, la même palette, le même dock en six verbes — jamais une capture d'image. L'écran d'ordinateur reprend la composition réelle de l'atelier : barre de marque, tambour dans sa couronne DMC, bande de mesures avec son zoom, dock. Sur ordinateur, l'écran suit la largeur du châssis (`container-type: inline-size`) pour rester lisible du grand écran au mobile, où les trois appareils passent en colonne : ordinateur, puis tablette et téléphone côte à côte.

## Dock de l'atelier

Six verbes, un picto lisible par geste :

| Entrée | Panneau / action |
|---|---|
| **Composer** | structure, tracé, densité, échelle, géométrie |
| **Colorer** | couronne DMC, palette, harmonies, contraste |
| **Ajuster** | toile, aïda, brins, marge, signature |
| **Broder** | mode broderie plein écran |
| **Sauvegarder** | collection et favoris |
| **Exporter** | PNG, SVG, CSV, PDF, projet ROSACE |

Les libellés sont affichés en capitales (`text-transform: uppercase`) pour lire le geste d'un coup d'œil ; les pictos ont été agrandis (26 px sur bureau). Les identifiants internes (`PanelId`) sont inchangés.

## Installation

```bash
cd "create-ultra-realistic-concept (15)"
npm ci --no-audit --no-fund
npm run dev
```

Node 22 est utilisé pour la validation. Vite sert l'application sur `0.0.0.0` avec hôtes de preview autorisés.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | singlefile de production dans `dist/index.html` |
| `npm run preview` | sert le build réel |
| `npm test` | 26 assertions Node/tsx |
| `npm run typecheck` | TypeScript strict, `src` + `tests` + `vite.config.ts` |
| `npm run test:browser` | parcours Playwright mobile + bureau |
| `npm run test:preview` | fumage du build servi |
| `npm run test:a11y` | accessibilité, clavier, réduction des animations sur 4 configurations — **bloquant, 0 violation axe** |
| `npm run licenses` | régénère `LICENSES.md` |
| `npm run test:all` | tests, typecheck, build, navigateur, preview |

`test:browser`, `test:preview` et `test:a11y` utilisent Chromium par défaut via `CHROMIUM_PATH` ; `BASE_URL` et `ARTIFACT_DIR` sont optionnels. `BROWSER=firefox|webkit` (avec `npx playwright install firefox webkit`) prépare les mêmes parcours pour Firefox et Safari/WebKit — **ces navigateurs ne sont pas encore exécutés**. Le workflow GitHub Actions est fourni dans `ci/github-workflow-ci.yml` : copiez-le vers `.github/workflows/ci.yml` une fois la permission `workflows` accordée à l'intégration GitHub pour activer la CI distante. Exemple :

```bash
CHROMIUM_PATH=/chemin/vers/chromium BASE_URL=http://127.0.0.1:5173 npm run test:browser
```

## Architecture

```
RosaceConfig ──normalizeConfig──► generateRosace ──► pattern
                                      │
                                      ├─ RosaceProvider : un seul patron
                                      ├─ paintPattern : tambour + grille
                                      ├─ patternFingerprint : empreinte
                                      ├─ chartRegions / exporters
                                      └─ buildProject / importProject
```

Fichiers structurants : `src/lib/rosace.ts` (moteur), `src/lib/paint.ts` (rendu partagé), `src/lib/progress.ts` (progression et projets), `src/state/rosace-store.tsx` (état unique), `src/components/EmbroideryView.tsx` (Broderie), `src/data/dmc.ts` (catalogue), `src/data/crown.ts` (couronne).

## Familles géométriques

Le curseur **Géométrie** propose six familles dans le même moteur, disponibles pour les cinq structures de pétales (6, 8, 10, 12, 14), les cinq tracés, densités, échelles, tourbillons et ondulations :

| Valeur | Famille | Lecture |
|---|---|---|
| 1 | Corolle | rosace d'origine, strictement préservée (`353C357F12EC80D5`, 3 381 croix) |
| 2 | Mandala | anneaux concentriques, rayons et losanges |
| 3 | Arabesque | ogives entrecroisées et festons |
| 4 | Kaléidoscope | miroirs en coins, facettes et losanges |
| 5 | Entrelacs | trame tissée et nœuds réguliers |
| 6 | Fractale | étoile emboîtée à plusieurs échelles |

Cinq nouvelles études (`PRESETS`) les présentent. La valeur 1 reste le défaut : anciens liens, projets version 1 et progressions existantes retrouvent exactement le même patron. Il n'existe toujours qu'un seul `generateRosace`.

Galerie comparative à paramètres identiques (graine 7, grille 101×101, structure 2, tracé 3, densité 3) : [`galerie/index.html`](../galerie/index.html).

## Formats d'export

| Format | Contenu | Réimportable |
|---|---|---|
| PNG toile / grille | 1600 × 1600, rendu ou symboles | non |
| SVG motif / grille | croix vectorielles ou grille symbolique | non |
| CSV fournitures | métrages, brins, échevettes, ligne `Total` | non |
| PDF fiche technique | 1 couverture + 4 planches = 5 pages | non |
| Lien `#r=` | recette exacte | recette seulement |
| `.rosace.json` v2 | recette + progression + journal + vue | **oui** |

Les projets **version 1** sont migrés explicitement vers v2 lorsque leur forme est reconnaissable ; sinon un message de compatibilité clair est affiché. Les anciennes clés locales de progression v1 sont également migrées.

## Progression

- Stockage : `aime-rosace-progress-v2:<empreinte>`.
- L'empreinte dépend de la taille, de la matrice et de la palette ; **pas** de la toile, de l'Aïda, des brins ni de la marge.
- `loadPatternProgress` nettoie les cases vides, le journal, la sélection et le zoom.
- `saveProgress` fusionne les écritures concurrentes entre onglets au lieu d'écraser silencieusement.
- `hashchange` / `popstate` appliquent les liens de recette et le retour/avant du navigateur.
- Stockage corrompu ou quota dépassé : l'application reste utilisable et avertit l'utilisatrice.

## Limites connues

- Validation terrain humaine (5 brodeuses, 3 recettes) encore à organiser ; les six familles géométriques sont vérifiées en Chromium headless, pas sur appareil réel.
- Couverture navigateur exécutée : Chromium 153 headless uniquement. Safari/WebKit et Firefox sont **préparés** via `BROWSER=webkit|firefox`, mais non exécutés ; appareils réels et gestes tactiles matériels restent à valider.
- La CI GitHub distante n'est pas encore active : le workflow est prêt dans `ci/github-workflow-ci.yml`, en attente de la permission `workflows`.
- Couleurs écran indicatives ; métrages et temps sont des estimations.
- Le lien de partage ne transporte pas la progression.
- Aucune licence de code n'est attribuée sans décision explicite ; voir `NOTICE.md`, `LICENSES.md` et le rapport final.
- Aucun déploiement de production n'est effectué par ce dépôt.

Rapport unique : `RAPPORT-CONSOLIDATION-FINALE.md`. Attributions : `NOTICE.md`. Contrôles qualité exécutés / prévus : `QUALITE-PRODUIT.md`.
