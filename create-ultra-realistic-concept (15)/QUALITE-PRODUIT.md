# Contrôles qualité produit — exécutés / prévus

Ce document distingue strictement ce qui **a été exécuté** de ce qui est **préparé mais non exécuté**. Les contrôles exécutés font échouer la commande concernée en cas de régression ; aucun contrôle simplement prévu n'est présenté comme réussi.

## Dernière revue avant fusion — points demandés

| Point demandé | Vérification exécutée | Résultat |
|---|---|---|
| Paramètres produisant des différences visibles et cohérentes | `npm test` + 6 captures navigateur | 26 tests ; 30 combinaisons géométrie × structure distinctes ; les 7 curseurs modifient la matrice |
| Symétrie annoncée | `npm test` | 30/30 combinaisons `mirrorSymmetric=true` |
| Recettes reproductibles | `npm test` | 11 `PRESETS`, `encodeConfig`/`decodeConfig`, ancien lien sans champ `geometry` → corolle |
| Nettoyage sans détérioration | `npm test` | 30/30 combinaisons `cleaned=0` ; correction des points isolés symétriques (voir ci-dessous) |
| PDF = prévisualisation | `npm test` + `npm run test:browser` | l'aperçu PDF est le SVG motif (signature sémantique identique) ; 4 planches couvrent chaque croix une fois ; 5 pages |
| Anciennes créations Corolle | `npm test` | `353C357F12EC80D5`, 3 381 croix, bit à bit préservées |
| Galerie comparative | `galerie/index.html` | 6 captures, mêmes paramètres, même graine 7, même grille 101×101 |
| Pas de septième famille | `GEOMETRY_COUNT=6` | confirmé |

Galerie : [`galerie/index.html`](../galerie/index.html) — 6 PNG réels du tambour, aucun visuel généré, aucun ajout de famille.

## Exécutés dans cette session

| Contrôle | Commande | Résultat | Bloquant ? |
|---|---|---|---|
| Suite unitaire | `npm test` | **26 tests réussis** | oui |
| Typecheck strict | `npm run typecheck` | exit 0 | oui en CI |
| Build singlefile | `npm run build` | 2506 modules, `dist/index.html` | oui en CI |
| Parcours navigateur Chromium | `npm run test:browser` | mobile 390×844 + bureau 1440×900, exit 0 | oui en CI |
| Build de production servi | `npm run test:preview` | exit 0 : HTTP 200, singlefile sans `/@vite/client` ni `/src/`, couronne 489, Broderie ouverte | oui en CI |
| Six familles géométriques | `npm test` + `npm run test:browser` | 6 empreintes distinctes, 5 structures × 6 familles, tous les curseurs actifs, corolle d'origine bit à bit préservée, 6 captures | oui en CI |
| PDF / prévisualisation | `npm test` + `npm run test:browser` | aperçu et planches issus de la même matrice pour les 6 géométries | oui |
| Export / réimport géométrie + progression | `npm run test:browser` | projet Fractale exporté puis réimporté, empreinte et croix marquée conservées | oui |
| Accessibilité automatisée | `npm run test:a11y` | **0 violation axe** sur 4 configurations, 39 passes chacune | **oui** |
| Navigation clavier | `npm run test:a11y` | 1er focus = lien d'évitement,Tab suivant = lien de marque, `Entrée` ouvre un panneau, `Échap` le ferme | oui |
| Préférence de réduction des animations | `npm run test:a11y` | `prefers-reduced-motion: reduce` respecté sur les 4 configurations | oui |
| Inventaire des licences | `npm run licenses` | 203 paquets, 8 licences distinctes | non |

Configurations axe : `mobile-jour`, `mobile-nuit`, `bureau-jour`, `bureau-nuit` (390×844 et 1280×900, thèmes jour/nuit). Rapport : `ARTIFACT_DIR/accessibilite.json`.

### Violations axe corrigées — cause, correction, justification du blocage

| Violation (avant) | Cause technique | Correction |
|---|---|---|
| `color-contrast` — 1 nœud, sérieux | `.studio-stats span { color: var(--trait-2) }` s'appliquait aussi à la valeur « 17,2 cm » : `#cfcfcb` sur `#ffffff`, ratio 1,56 au lieu de 4,5. Le séparateur « · » était visé, pas la donnée. | Règle spécifique `.studio-stats .stat-cm:not([aria-hidden="true"]) { color: var(--encre-2) }` ; le séparateur reste discret, la valeur passe en `--encre-2`. |
| `label-content-name-mismatch` — 7 nœuds, sérieux | 6 boutons du dock et « Recentrer la vue » avaient un `aria-label` qui ne contenait pas tout le texte visible : libellé + numéro de raccourci `<kbd>` et « 100 % ». axe-core 4.14 compte le texte visible même quand il est `aria-hidden` (WCAG 2.5.3 « Label in Name »). | Dock : suppression des `aria-label`, nom accessible issu du contenu (`<span>` + `<kbd>` sans `aria-hidden`), alerte de contraste déplacée vers `aria-describedby`. Zoom : `aria-label="Recentrer la vue, 100 %"`. Ajout d'un `h1.sr-only` dans l'unique `<main>` et d'un lien d'évitement invisible par opacité mais toujours focusable. |

**Pourquoi ces contrôles sont devenus bloquants** : ce sont des critères WCAG A/AA (1.4.3 contraste, 2.5.3 label in name) corrigeables sans modifier le design validé — seul un jeton de couleur, des libellés accessibles et un `sr-only` ont changé. `npm run test:a11y` et le workflow CI échouent désormais sur toute violation, tout focus initial incorrect ou tout raccourci clavier cassé. Il n'est donc plus question de les classer « non bloquantes ».

Un seul contrôle reste `incomplete` par configuration : `color-contrast` sur 2 à 4 séparateurs « · » décoratifs, `aria-hidden="true"`, sans information portée ; axe ne peut pas calculer leur ratio sur le fond du bandeau. Ce n'est pas une violation et cela ne bloque pas la CI. Vérification manuelle : aucun texte informatif n'est concerné.

### Nettoyage des motifs

Le contrôle de brodabilité retirait auparavant 4 points de contour isolés mais formant **deux paires miroir parfaites** sur la structure 4 de la Corolle. Ils sont désormais reconnus comme détails volontaires : une croix isolée asymétrique est retirée, une croix isolée dont le symétrique est également isolé (ou le point central) est conservée. Résultat : `cleaned=0` et `mirrorSymmetric=true` sur les 30 combinaisons, sans changer la recette par défaut.

## CI GitHub

- Workflow prêt : `ci/github-workflow-ci.yml` ; copie préparée pour `.github/workflows/ci.yml`.
- `npm run test:a11y` y est **bloquant** (le `|| echo` a été retiré).
- **CI distante non active à ce stade** : `gh pr checks 1` ne remonte aucun check. L'intégration GitHub de cette session n'a pas la permission `workflows` ; tout push contenant `.github/workflows/*.yml` est refusé (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`). Aucun contournement par API, PAT ou autre jeton n'a été utilisé.
- Permission supplémentaire nécessaire : **`workflows: write`** sur l'installation de la GitHub App (en plus de `contents: write` déjà accordée). Voir procédure exacte dans le rapport final.
- Toutes les étapes du workflow ont été exécutées localement ; une compilation réussie n'est pas présentée comme une validation fonctionnelle.

## Préparés, non exécutés

| Contrôle | Préparation exacte | Ce qui reste à faire | Exécuté ? |
|---|---|---|---|
| Firefox | `BROWSER=firefox` pris en charge par `test:browser`, `test:preview`, `test:a11y` ; `npx playwright install firefox` | lancer les trois commandes avec `BROWSER=firefox` | **non** |
| Safari / WebKit | `BROWSER=webkit` pris en charge par les mêmes scripts ; `npx playwright install webkit` | lancer les trois commandes avec `BROWSER=webkit`, idéalement sur macOS/iOS | **non** |
| Appareils tactiles réels | alternatives clavier et boutons déjà testées | cinq appareils physiques, pincement réel, `pointercancel`, lecteur d'écran | **non** |
| Impression physique du PDF | PDF 5 pages validé en navigateur | impression papier, repères et marges | **non** |
| Ouverture des exports externes | signatures PNG, SVG, CSV, PDF vérifiées | CSV dans Excel/LibreOffice, SVG dans un logiciel vectoriel, PNG avec DPI | **non** |
| Tests terrain cinq brodeuses | protocole au §6 du rapport final | recruter 5 profils, 3 recettes, 30 min, grille de critères | **non** |

Commandes préparées (à ne pas confondre avec des résultats) :
```bash
npx playwright install firefox webkit
BROWSER=firefox BASE_URL=http://127.0.0.1:5173 npm run test:browser
BROWSER=webkit  BASE_URL=http://127.0.0.1:5173 npm run test:browser
BROWSER=firefox BASE_URL=http://127.0.0.1:5173 npm run test:a11y
BROWSER=webkit  BASE_URL=http://127.0.0.1:5173 npm run test:a11y
```

## Matrice de couverture navigateur

| Navigateur | Automatisé | Exécuté | Prévu |
|---|---|---|---|
| Chromium 153 headless | oui | **oui** | — |
| Firefox | préparé (`BROWSER=firefox`) | non | **oui** |
| Safari / WebKit | préparé (`BROWSER=webkit`) | non | **oui** |
| Appareil tactile réel | non | non | **oui** |

## Séparation des droits

| Élément | Statut |
|---|---|
| **Code applicatif ROSACE** | Aucun fichier `LICENSE` ; aucune licence MIT, GPL, Apache ou autre attribuée. Tous droits réservés par défaut, en attente de décision explicite. |
| Dépendances npm | `LICENSES.md` : 203 paquets, 8 licences distinctes, inventaire généré. |
| Données DMC | MakeBead `craft-color-codes` — CC BY 4.0 ; attribution dans `NOTICE.md`, `README.md` et les exports SVG/PDF. |
| Police Bodoni Moda | OFL 1.1 ; attribution dans `NOTICE.md`. |

Les notices tierces sont conservées ; elles ne confèrent aucun droit sur le code ROSACE et ne constituent pas un choix de licence pour ce code.

## Parcours couverts par `npm run test:browser`

Création d'une rosace, modification des réglages, annuler/rétablir de recette, curseur Géométrie 1–6 avec six captures et retour à la corolle, **export/réimport d'un projet Fractale avec progression**, export PNG/SVG/CSV/PDF, **comparaison sémantique aperçu PDF ↔ SVG motif**, export et réimport de projet v2, migration et refus clair de projet v1, mode Broderie, marquage de croix, annuler/rétablir, fermeture et reprise, zoom, filtres, catalogue 489 fils, liens legacy, `hashchange`/`popstate`/retour-avant, concurrence entre deux onglets, stockage corrompu, ancienne clé v1, quota dépassé, `Échap` avec focus dans un champ, dock bureau, petit écran 390×844.
