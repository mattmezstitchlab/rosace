# ROSACE

> Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.

ROSACE est un atelier de point de croix à écran fixe : une recette produit **un seul patron**, affiché dans le tambour, puis suivi dans le mode **Broder** jusqu'aux dernières croix. La géométrie, les couleurs, les calculs de fil, les exports et la progression partagent la même matrice.

## Concept

- Six réglages de forme, cinq harmonies, 489 références DMC, couronne chromatique complète.
- Recette reproductible par signature et liens `#r=`.
- **Tambour** = vue textile ; **Broder** = vue technique de la même grille.
- Progression séparée du motif, indexée par empreinte du patron, jamais mélangée à la recette.
- Design, couronne chromatique et ergonomie mobile conservés.

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
| `npm test` | 23 assertions Node/tsx |
| `npm run typecheck` | TypeScript strict, `src` + `tests` + `vite.config.ts` |
| `npm run test:browser` | parcours Playwright mobile + bureau |
| `npm run test:preview` | fumage du build servi |
| `npm run test:a11y` | accessibilité, clavier, réduction des animations (non bloquant) |
| `npm run licenses` | régénère `LICENSES.md` |
| `npm run test:all` | tests, typecheck, build, navigateur, preview |

`test:browser`, `test:preview` et `test:a11y` nécessitent un binaire Chromium externe via `CHROMIUM_PATH` ; `BASE_URL` et `ARTIFACT_DIR` sont optionnels. Le workflow GitHub Actions est fourni dans `ci/github-workflow-ci.yml` : copiez-le vers `.github/workflows/ci.yml` une fois la permission `workflows` accordée à l'intégration GitHub pour activer la CI distante. Exemple :

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

- Validation terrain humaine (5 brodeuses, 3 recettes) encore à organiser.
- Couverture navigateur automatisée : Chromium ; Safari, Firefox, appareils réels et gestes tactiles matériels restent à valider.
- Couleurs écran indicatives ; métrages et temps sont des estimations.
- Le lien de partage ne transporte pas la progression.
- Aucune licence de code n'est attribuée sans décision explicite ; voir `NOTICE.md`, `LICENSES.md` et le rapport final.
- Aucun déploiement de production n'est effectué par ce dépôt.

Rapport unique : `RAPPORT-CONSOLIDATION-FINALE.md`. Attributions : `NOTICE.md`. Contrôles qualité exécutés / prévus : `QUALITE-PRODUIT.md`.
