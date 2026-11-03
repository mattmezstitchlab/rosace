# Contrôles qualité produit — exécutés / prévus

Ce document distingue strictement ce qui **a été exécuté** de ce qui est **préparé mais non exécuté**. Aucun contrôle prévu ne bloque la PR.

## Exécutés dans cette session

| Contrôle | Commande | Résultat | Bloquant ? |
|---|---|---|---|
| Suite unitaire | `npm test` | 23 tests réussis | non |
| Typecheck strict | `npm run typecheck` | exit 0 | oui en CI |
| Build singlefile | `npm run build` | 2506 modules, `dist/index.html` | oui en CI |
| Parcours navigateur Chromium | `npm run test:browser` | mobile 390×844 + bureau 1440×900, exit 0 | oui en CI |
| Build de production servi | `npm run test:preview` | exit 0 : HTTP 200, singlefile sans `/@vite/client` ni `/src/`, couronne 489, Broderie ouverte | oui en CI |
| Accessibilité automatisée | `npm run test:a11y` | axe : **2 violations sérieuses**, 37 passes, 1 incomplet | **non** |
| Navigation clavier | `npm run test:a11y` | 1er focus = lien, `Entrée` ouvre un panneau, `Échap` le ferme | non |
| Préférence de réduction des animations | `npm run test:a11y` | `prefers-reduced-motion: reduce` respecté par le contexte | non |
| Inventaire des licences | `npm run licenses` | 203 paquets, 8 licences distinctes | non |

Détail des violations axe non bloquantes, rapportées dans `ARTIFACT_DIR/accessibilite.json` :
- `color-contrast` : 1 nœud ;
- `label-content-name-mismatch` : 7 nœuds.

Elles sont documentées comme limites, pas corrigées dans cette phase, afin de ne pas modifier le design validé sans nécessité démontrée.

## Préparés, non exécutés

| Contrôle | Préparation | Ce qui reste à faire | Bloquant ? |
|---|---|---|---|
| Safari | matrice de couverture ci-dessous | exécuter `test:browser` avec WebKit sur macOS/iOS | non |
| Firefox | matrice de couverture ci-dessous | exécuter `test:browser` avec Firefox | non |
| Gestes tactiles réels | alternatives clavier et boutons déjà testées | cinq appareils physiques, pincement réel, `pointercancel` | non |
| Impression physique du PDF | PDF 5 pages validé en navigateur | impression papier, vérification des repères et des marges | non |
| Ouverture des exports externes | signatures PNG, SVG, CSV, PDF vérifiées | ouvrir CSV dans Excel/LibreOffice, SVG dans un logiciel vectoriel, PNG avec DPI | non |
| Tests terrain cinq brodeuses | protocole au §10 du rapport final | recruter 5 profils, 3 recettes, 30 min, grille de critères | non |
| Correctifs axe | rapport JSON versionné hors dépôt | décider si les 2 violations doivent être corrigées | non |

## Matrice de couverture navigateur

| Navigateur | Automatisé | Exécuté | Prévu |
|---|---|---|---|
| Chromium 153 headless | oui | **oui** | — |
| Chromium réel / Chrome | non | non | optionnel |
| Firefox | non | non | **oui** |
| Safari / iOS | non | non | **oui** |
| Appareil tactile réel | non | non | **oui** |

## Parcours couverts par `npm run test:browser`

Création d'une rosace, modification des réglages, annuler/rétablir de recette, export PNG/SVG/CSV/PDF, export et réimport de projet v2, migration et refus clair de projet v1, mode Broderie, marquage de croix, annuler/rétablir, fermeture et reprise, zoom, filtres, catalogue 489 fils, liens legacy, `hashchange`/`popstate`/retour-avant, concurrence entre deux onglets, stockage corrompu, ancienne clé v1, quota dépassé, `Échap` avec focus dans un champ, dock bureau.
