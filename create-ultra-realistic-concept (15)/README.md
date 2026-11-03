# ROSACE

> Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.

ROSACE est un atelier de point de croix à écran fixe : une recette produit **un seul patron**, affiché dans le tambour, puis suivi dans le mode **Broder** jusqu'aux dernières croix. La géométrie, les couleurs, les calculs de fil, les exports et la progression partagent la même matrice.

Deux façons de créer, un seul espace pour broder : **composer une rosace** (recette paramétrique) ou **importer un patron PDF** (puzzle de recomposition des pages). Dans les deux cas l'ouvrage est un `StitchWork` : une matrice canonique de croix, une palette DMC, une empreinte, une progression.

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
| `/#atelier-importer` | atelier, import d'un patron PDF ouvert |
| `/#atelier-patron` | atelier sur un patron importé (pas de recette à partager) |
| `/#r=…` | atelier sur une recette partagée |

Les liens `#atelier…` sont remplacés dès l'ouverture par la recette courante (`#r=…`), pour que l'URL reste partageable. La marque, en haut de l'atelier, ramène à la présentation.

La présentation (`src/landing/`) ne raconte pas l'interface : elle montre des **patrons réels**, rendus par `generateRosace` + `paintPattern`, avec les mêmes chiffres que l'atelier (croix, centimètres, fils, durée). Elle présente les **trois portes** de l'atelier (créer une rosace, importer un patron PDF, écrire un texte brodé — la grille du mot « ROSACE » est produite par `textGrid`), puis une section sombre **Broder, en vrai** : les quatre affichages du mode Broder (symboles, couleurs, les deux, toile) rendus par le même `paintPattern`, et les six aides à l'ouvrage (fil conducteur, rythme et prévision, broder ensemble, boîte à fils, tambour sur mesure, fiche réimportable). L'exemple de prévision est calculé par le vrai moteur des séances sur des soirées **explicitement fictives**, et l'échelle du tambour par `suggestScale` (`src/landing/data.ts`). Le comparateur motif/grille recale la marge technique de la grille sur celle du rendu textile : les deux moitiés coïncident exactement au trait de comparaison.

L'en-tête porte le mot-symbole **ROSACE** en très grand et centré, à la manière d'un masthead ; une barre fine prend le relais dès que l'on descend. La page n'utilise qu'une seule famille typographique, la moderne de la marque : pas d'italique classique, l'emphase passe par la graisse et la couleur.

Le comparateur motif/grille se balaie à la main : on attrape le trait dans l'image (souris, doigt), ou on le déplace au clavier (flèches, `Maj` pour aller plus vite, `Début`/`Fin`). Le trait porte `role="slider"`, avec sa valeur annoncée en pourcentage de grille.

Fond blanc, sections alternées en gris très clair, deux temps sombres (la carte des exports, l'appel final). L'atelier est **mis en situation** dans des châssis d'ordinateur, de tablette et de téléphone (`src/landing/devices.tsx`) : chaque écran est composé avec le moteur du produit — la même rosace, la même palette, le même dock en six verbes — jamais une capture d'image. L'écran d'ordinateur reprend la composition réelle de l'atelier : barre de marque, tambour dans sa couronne DMC, bande de mesures avec son zoom, dock. Sur ordinateur, l'écran suit la largeur du châssis (`container-type: inline-size`) pour rester lisible du grand écran au mobile, où les trois appareils passent en colonne : ordinateur, puis tablette et téléphone côte à côte.

## Dock de l'atelier

Sept verbes, un picto lisible par geste :

| Entrée | Panneau / action |
|---|---|
| **Composer** | structure, tracé, densité, échelle, géométrie |
| **Colorer** | couronne DMC, palette, harmonies, contraste |
| **Ajuster** | toile, aïda, brins, marge, signature |
| **Broder** | mode broderie plein écran |
| **Sauvegarder** | collection et favoris |
| **Exporter** | PNG, SVG, CSV, PDF, projet ROSACE |
| **Importer** | un patron PDF : Analyser, Caler, Assembler, Vérifier, Utiliser |

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
| `npm run build` | build de production multifichier dans `dist/` (pdf.js chargé à la demande) ; `ROSACE_SINGLEFILE=1 npm run build` produit l'ancien fichier unique |
| `npm run preview` | sert le build réel |
| `npm test` | assertions Node/tsx : `tests/verify.ts` (moteur, StitchWork, non-régression de 161 empreintes) puis `tests/import-pdf.ts` (noyau d'import PDF) |
| `npm run typecheck` | TypeScript strict, `src` + `tests` + `vite.config.ts` |
| `npm run test:browser` | parcours Playwright mobile + bureau, puis parcours d'import PDF (un vrai PDF produit par Chromium) |
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
RosaceConfig ──normalizeConfig──► generateRosace ──► RosacePattern ──fromRosace──┐
                                                                                  ├──► StitchWork (origin, width, height, cells, palette, fingerprint)
PDF ──analyzePdf / readVectorChart / readCompleteGlyphChart──► montage ──fromImport┘        │
                                                                                            ├─ paintPattern : tambour + grille
                                                                                            ├─ workFingerprint : empreinte
                                                                                            ├─ chartRegions / exporters
                                                                                            └─ buildProject (v2 rosace, v3 import) / importProject
```

Fichiers structurants : `src/lib/rosace.ts` (moteur, inchangé), `src/lib/work.ts` (StitchWork et adaptateurs), `src/lib/stats.ts` (mesures partagées), `src/lib/import-pdf/` (noyau d'import PDF, voir `PROVENANCE.md`), `src/lib/paint.ts` (rendu partagé), `src/lib/progress.ts` (progression et projets), `src/state/rosace-store.tsx` (état unique, deux origines), `src/components/EmbroideryView.tsx` (Broderie), `src/components/ImportPdf.tsx` (import), `src/data/dmc.ts` (catalogue), `src/data/crown.ts` (couronne).

## Importer un patron PDF

Le moteur de lecture et de recomposition vient de Point Zéro (copie contrôlée, `src/lib/import-pdf/PROVENANCE.md`). Quatre étapes dans l'atelier, même navigation, mêmes jetons : **Analyser** (pages, légende, mode de lecture), **Caler** (grilles détectées, zones oubliées, blocs écartés), **Assembler** (table de montage aimantée, ordre des cartes, lecture exacte / automatique / photo, corrections DMC), **Vérifier** (dimensions annoncées, recouvrements, trous, symboles non résolus, points non repris : rien d'approximatif n'est présenté comme exact). **Utiliser** remplace l'ouvrage actif et ouvre Broder ; annuler à n'importe quelle étape ne touche à rien.

Un patron importé n'a pas de recette : pas de lien `#r=`, pas de favori ; il se partage par le projet `.rosace.json` **version 3** (matrice embarquée). Les rosaces restent en version 2. Sa progression est liée à son empreinte comme pour une rosace.

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
| `.rosace.json` v2 | recette + progression + journal + vue (rosace) | **oui** |
| `.rosace.json` v3 | matrice + palette + provenance + progression (patron importé) | **oui** |

Les projets **version 1** sont migrés explicitement vers v2 lorsque leur forme est reconnaissable ; sinon un message de compatibilité clair est affiché. Les anciennes clés locales de progression v1 sont également migrées.

## Progression

- Stockage : `aime-rosace-progress-v2:<empreinte>`.
- L'empreinte dépend de la taille, de la matrice et de la palette ; **pas** de la toile, de l'Aïda, des brins ni de la marge.
- `loadPatternProgress` nettoie les cases vides, le journal, la sélection et le zoom.
- `saveProgress` fusionne les écritures concurrentes entre onglets au lieu d'écraser silencieusement.
- `hashchange` / `popstate` appliquent les liens de recette et le retour/avant du navigateur.
- Stockage corrompu ou quota dépassé : l'application reste utilisable et avertit l'utilisatrice.

### Broder, en vrai

- **Affichage** : symboles, couleurs, les deux, ou toile (`aime-rosace-broder-affichage-v1`), même grille, même progression.
- **Fil conducteur** : le fil choisi est conservé entre deux ouvertures ; à défaut, c'est celui de la dernière croix cochée. « Suivante » va à la zone la plus proche du même fil.
- **Séances** (`src/lib/sessions.ts`) : les croix cochées s'agrègent en séances (écart > 20 min = nouvelle séance), rangées dans la progression et le projet. Le rythme n'est annoncé qu'à partir de 30 croix sur 10 minutes ; la prévision est une **fourchette** (±30 %) et une date probable, jamais une promesse.
- **Broder ensemble** : un projet ROSACE de la même empreinte s'affiche en calque (`PEER_KEY`), sans jamais écrire dans la progression locale ; un autre ouvrage est refusé.
- **Boîte à fils** (`src/lib/threadbox.ts`, `aime-rosace-boite-a-fils-v1`) : codes DMC possédés, liste de courses des manquants en échevettes, export CSV.
- **Tambour** (`src/lib/hoop.ts`) : pour un diamètre donné, la plus grande échelle qui tient avec 1,5 cm de marge ; sinon un aïda plus fin est suggéré.
- **Fiche réimportable** : la couverture de la fiche PDF porte `ROSACE-FICHE <empreinte> r=<recette> FIN-FICHE` ; l'import la reconnaît, régénère la recette et **compare l'empreinte** avant d'accepter (`src/lib/import-pdf/worksheet.ts`).
- **Texte brodé** (`src/lib/text.ts`) : police 5 × 7 dessinée pour l'aïda (capitales, chiffres, accents courants), un fil de texte et une ombre facultative ; les caractères inconnus sont annoncés.

## Limites connues

- Validation terrain humaine (5 brodeuses, 3 recettes) encore à organiser ; les six familles géométriques sont vérifiées en Chromium headless, pas sur appareil réel.
- Couverture navigateur exécutée : Chromium 153 headless uniquement. Safari/WebKit et Firefox sont **préparés** via `BROWSER=webkit|firefox`, mais non exécutés ; appareils réels et gestes tactiles matériels restent à valider.
- La CI GitHub distante n'est pas encore active : le workflow est prêt dans `ci/github-workflow-ci.yml`, en attente de la permission `workflows`.
- Couleurs écran indicatives ; métrages et temps sont des estimations.
- Le lien de partage ne transporte pas la progression.
- Import PDF : demi-points, quarts, points arrière, nœuds et mélanges de fils ne sont pas lus (signalé à l'étape Vérifier) ; la lecture par image dépend de la qualité de la légende ; les tests utilisent un PDF synthétique produit par Chromium, les PDF réels restent à contrôler à la main.
- Aucune licence de code n'est attribuée sans décision explicite ; voir `NOTICE.md`, `LICENSES.md` et le rapport final.
- Aucun déploiement de production n'est effectué par ce dépôt.

Rapport unique : `RAPPORT-CONSOLIDATION-FINALE.md`. Attributions : `NOTICE.md`. Contrôles qualité exécutés / prévus : `QUALITE-PRODUIT.md`.
