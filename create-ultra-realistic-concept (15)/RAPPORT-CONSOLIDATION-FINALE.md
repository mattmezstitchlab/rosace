# ROSACE — rapport de consolidation finale et dernière revue avant fusion

> Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.

Ce document est le **seul rapport applicatif** de la branche. Les anciens rapports `ATLAS-INTEGRATION.md`, `DMC-SOURCES.md` et `LOT-2-RAPPORT.md` ont été supprimés ; ce fichier les remplace. Les contrôles qualité exécutés / prévus sont détaillés dans `QUALITE-PRODUIT.md`, sans créer de second rapport de consolidation.

---

## 0. Dernière revue avant fusion — rapport court

### État exact de la PR

| Élément | Valeur |
|---|---|
| Dépôt | `https://github.com/mattmezstitchlab/rosace` |
| Branche | `https://github.com/mattmezstitchlab/rosace/tree/arena/538bb149-rosace` |
| PR #1 | `https://github.com/mattmezstitchlab/rosace/pull/1` — **`OPEN`**, `merged=false`, `closedAt=null`, `mergeable=true`, base `main`, head `arena/538bb149-rosace` |
| Contrôles automatiques GitHub | **aucun check affiché** (`gh pr checks 1` → « no checks reported »), CI distante non active |
| Fusion / déploiement | **non effectués, interdits sans accord explicite** |
| Commit final | transmis en réponse finale et en commentaire de PR après le dernier push |

### Modifications depuis le dernier commit `24cd611`

**23 fichiers depuis `24cd611` : 551 insertions / 130 suppressions** (16 fichiers suivis modifiés + `galerie/index.html` et 6 PNG ajoutés). Depuis `main` : **42 fichiers, 3 334 insertions / 566 suppressions**. Détail en §7. Aucun fichier `LICENSE`, aucun second moteur, aucune septième famille, aucune modification du design validé.

- **Accessibilité** : 2 violations axe sérieuses corrigées à la source ; `npm run test:a11y` est devenu **bloquant** et valide 0 violation sur 4 configurations.
- **Géométries** : 6 familles conservées, 30 combinaisons géométrie × structure vérifiées `mirrorSymmetric=true` et `cleaned=0` ; nettoyage corrigé pour préserver les points isolés symétriques.
- **Reproductibilité / PDF** : ancien lien sans champ `geometry` → Corolle d'origine ; aperçu PDF = SVG motif ; 4 planches couvrent chaque croix une fois.
- **Parcours** : export/réimport d'un projet Fractale avec progression conservée ; petit écran, Broderie, navigation, stockage, build servi.
- **Galerie** : [`galerie/index.html`](../galerie/index.html), 6 captures réelles, mêmes paramètres, même graine 7, même grille 101×101.
- **CI** : workflow mis à jour (a11y bloquante) et copie préparée sous `.github/workflows/ci.yml` en local ; activation refusée par GitHub faute de permission `workflows`. Aucun contournement.

### Contrôles CI

| Contrôle | Exécuté localement | CI distante |
|---|---|---|
| `npm test` | **26 tests réussis** | prête, non active |
| `npm run typecheck` | exit 0 | prête, non active |
| `npm run build` | 2506 modules, `dist/index.html` **753.29 kB / gzip 336.71 kB** | prête, non active |
| `npm run licenses` | 203 paquets, 8 licences | prête, non active |
| `npm run test:browser` | Chromium 153, mobile + bureau, exit 0 | prête, non active |
| `npm run test:preview` | build de production servi, exit 0 | prête, non active |
| `npm run test:a11y` | **0 violation axe**, 39 passes, 4 configs, 3 exécutions consécutives | **bloquante** dans le workflow, non active |

Une compilation réussie n'est pas une validation fonctionnelle. Procédure d'activation et permission exacte : §5.

### Violations axe corrigées

| Violation | Cause | Correction |
|---|---|---|
| `color-contrast` (1 nœud) | la valeur « 17,2 cm » héritait de `--trait-2` (`#cfcfcb` sur blanc, ratio 1,56) | règle spécifique `.stat-cm:not([aria-hidden])` → `--encre-2` |
| `label-content-name-mismatch` (7 nœuds) | `aria-label` du dock et de « Recentrer » ne contenait pas le texte visible (`<kbd>`, « 100 % ») ; axe 4.14 compte le texte visible même `aria-hidden` | noms issus du contenu, `aria-describedby`, `aria-label="Recentrer la vue, 100 %"`, `h1.sr-only`, lien d'évitement focusable |

Justification technique du blocage : WCAG 1.4.3 (AA) et 2.5.3 (A), corrigeables sans redesign. `test:a11y` échoue désormais sur toute violation, focus incorrect ou raccourci clavier cassé. Un seul `incomplete` par configuration subsiste : `color-contrast` sur 2 à 4 séparateurs « · » décoratifs `aria-hidden`, sans information portée ; ce n'est pas une violation.

### Régressions éventuelles

**Aucune régression détectée.** Invariants : Corolle `353C357F12EC80D5`, 3 381 croix, 101×101, 489 fils, couronne, tambour, outils, roue chromatique, design et mobile préservés. Les compteurs Entrelacs / Fractale ont évolué (4 621 / 1 465 croix) parce que le curseur Tracé les fait désormais réagir, comme demandé ; la recette par défaut reste bit à bit identique. Le correctif de nettoyage conserve 4 points symétriques auparavant supprimés sur la structure 4, sans modifier la recette par défaut.

### Limites restantes

CI distante non active ; Safari / Firefox / appareils réels / gestes tactiles matériels / impression papier / ouverture des exports dans applications externes / protocole cinq brodeuses **préparés mais non exécutés** ; 1 `incomplete` axe sur séparateurs décoratifs ; aucune licence de code décidée ; aucune fusion ni déploiement.

### Galerie des six familles

[`galerie/index.html`](../galerie/index.html) — Corolle, Mandala, Arabesque, Kaléidoscope, Entrelacs, Fractale, mêmes paramètres, même graine, même taille. Aucune septième famille.

---

## 1. Récupération et sauvegarde GitHub

Le workspace `/home/user/rosace` **a été récupéré** : le système de fichiers est revenu avec le dépôt Git, la branche `arena/538bb149-rosace` et le commit `d281aa82f41c26d1afc3e82c49aa93ae8980cd37` (`d281aa8`). Preuves : `git log -1`, `git show --stat HEAD`, `git ls-remote origin`, `gh pr view 1`. Aucune reconstruction complète n'a été nécessaire, aucune copie de sauvegarde externe n'a été prétendue.

| Élément | Valeur |
|---|---|
| Dépôt | `https://github.com/mattmezstitchlab/rosace` |
| Branche distante | `https://github.com/mattmezstitchlab/rosace/tree/arena/538bb149-rosace` |
| PR | `https://github.com/mattmezstitchlab/rosace/pull/1` — `OPEN`, non fusionnée |
| Base / head | `main` ← `arena/538bb149-rosace` |
| Commit de consolidation initial | `d281aa82f41c26d1afc3e82c49aa93ae8980cd37` |
| Commit final | `HEAD` de la branche après cette livraison ; hash exact transmis dans la réponse finale et en commentaire de PR |
| `main` | inchangé à `245064f353fd74aa34a9ffd8c0fdcf07d996d12c` |

La PR #1 n'est **pas fusionnée**, `mergedAt=null`, `closedAt=null`, `mergeable=true`. **Aucun déploiement** n'a été effectué.

---

## 2. Consolidation canonique déjà livrée

- Un seul moteur `generateRosace` dans `src/lib/rosace.ts`, un seul `RosaceProvider`, un seul rendu de matrice `paintPattern` partagé entre le tambour et la Broderie.
- Un seul point d'entrée projet/progression : `src/lib/progress.ts`.
- Suppression des doublons, validateurs divergents, hook mort `src/lib/useMediaQuery.ts`, CSS morts et trois rapports périmés.
- **Préservés** : le design validé, la couronne de 489 fils, l'ergonomie mobile, les exports, les raccourcis et les 489 références DMC.
- Vérifications invariants : 101×101, **3 381 croix**, empreinte `353C357F12EC80D5`, 161 + 328 = 489 références, `missingFromRef=[]`, PDF 5 pages, PNG 1600².

Aucune modification du design validé ni du moteur géométrique n'a été faite sans nécessité démontrée. La dernière revue a corrigé le contrôle de brodabilité sur la base de 30 combinaisons testées, sans toucher à la recette par défaut.

---

## 3. Phase 1 — corrections prioritaires, toutes implémentées et vérifiées

| Correction | Implémentation | Vérification |
|---|---|---|
| 1. Navigation `hashchange`, `popstate`, retour/avant, liens de recettes | `applyLocationRecipe`, `replaceState`, listeners `hashchange` et `popstate` dans `src/state/rosace-store.tsx` | `npm run test:browser` |
| 2. Progression concurrente entre onglets sans écrasement silencieux | `saveProgress(progress, base)` + `reconcileProgress(remote, local, base)` ; `EmbroideryView.tsx` écoute `storage` | tests de progression + parcours deux onglets |
| 3. Import anciens projets / progressions v1 | `migrateProjectV1`, `loadLegacyProgress`, `migrateLegacyProgressRecord` ; toast « Projet version 1 migré » ; refus clair si empreinte inconnue | tests d'import v1 + parcours navigateur |
| 4. `Échap` ferme les panneaux même avec focus dans un champ | garde déplacée avant le test `INPUT`/`TEXTAREA` dans `src/components/Composer.tsx` | parcours focus `input[type=range]` + `Échap` |
| 5. Stockage corrompu et quota dépassé | `loadPatternProgress` nettoie les données invalides ; `saveProgress` capture les `DOMException` | tests de stockage + parcours quota simulé |
| 6. Build de production réellement servi | `tests/preview-smoke.ts` exécuté contre `npm run preview` sur le port 4173 | `npm run test:preview` exit 0 |

Détails : clé canonique `aime-rosace-progress-v2:<empreinte>` ; anciennes clés `aime-rosace-progress-v1:`, `aime-rosace-progress:`, `rosace-progress-v1:` ; `PROJECT_FORMAT="rosace-project"` ; `PROJECT_VERSION=2` ; `clampViewport` 0.8–8 ; `buildProject` nettoie aussi progression, journal et vue.

**Défauts corrigés au passage** : `TS2367` sur `probe.version`, assertion de sélection v1 inconnue, `closePanel` rendu idempotent, titre erroné et fuite de Chromium dans le script de fumage, anciens défauts d'I/O projet / journal et `TS6133`.

---

## 4. Phase 2 — README, NOTICE, licences

- `README.md` : concept, installation, commandes, architecture, six géométries, galerie, formats d'export, progression, limites.
- `NOTICE.md` : séparation explicite des droits, attribution MakeBead `craft-color-codes` / DMC **CC BY 4.0** et Bodoni Moda **OFL 1.1**.
- `scripts/inventaire-licences.mjs` + `npm run licenses` → `LICENSES.md` généré le `2026-11-03T04:56:50.539Z` : **203 paquets, 8 licences distinctes** — MIT 173, MPL-2.0 14, ISC 7, Apache-2.0 5, OFL-1.1 1, CC-BY-4.0 1, BSD-3-Clause 1, 0BSD 1.
- **Aucune licence de code applicatif n'a été attribuée.** Le dépôt reste `license=null`, aucun `LICENSE` créé, conformément à la consigne explicite. Les notices tierces ne s'étendent pas au code ROSACE.

### Options de licence du code — décision utilisateur requise

| Option | Conséquences |
|---|---|
| **A. Statut actuel : tous droits réservés, aucun fichier `LICENSE`** | Dépôt public mais réutilisation juridiquement ambiguë ; aucun tiers ne peut légalement fork/publier une version dérivée sans accord. Compatible avec la consigne actuelle. |
| **B. MIT** | Permissif, très compatible avec les dépendances ; exige seulement conservation du copyright et de la notice. Pas de clause de brevet explicite. |
| **C. Apache-2.0** | Permissif avec concession de brevet explicite et obligations `NOTICE` ; plus verbeux, adapté si une protection brevet est souhaitée. |
| **D. GPL-3.0 / AGPL-3.0** | Copyleft : toute œuvre dérivée doit publier ses sources sous la même licence ; l'AGPL couvre aussi l'usage via réseau. Peut décourager l'intégration commerciale. |
| **E. CC BY-NC-SA 4.0** | **Déconseillé pour du logiciel** : restriction non commerciale et incompatibilité avec de nombreuses licences open source ; éventuellement réservé aux contenus créatifs, pas au code. |

Toutes les dépendances listées restent permissives ; le choix ci-dessus doit être fait par le propriétaire du dépôt avant tout ajout de `LICENSE`.

---

## 5. Phase 3 — CI GitHub et parcours réellement vérifiés

Le workflow est fourni dans `ci/github-workflow-ci.yml` et une copie est **préparée en local** sous `.github/workflows/ci.yml` (non poussée). Une fois activé, il exécute sur chaque PR vers `main` et chaque push sur la branche :

1. `npm ci --no-audit --no-fund` ;
2. `npm test` ;
3. `npm run typecheck` ;
4. `npm run build` ;
5. `npm run licenses` ;
6. `npx playwright install --with-deps chromium` ;
7. `npm run test:browser` et **`npm run test:a11y` bloquant** sur `npm run dev` ;
8. `npm run test:preview` sur `npm run preview` ;
9. upload des artefacts.

Le `|| echo` qui rendait l'accessibilité non bloquante a été retiré. Le workflow distingue bien la compilation de la validation fonctionnelle : les parcours navigateur et le fumage du build servi sont obligatoires.

### État distant et tentative d'activation

Une tentative normale de push de `.github/workflows/ci.yml` a été effectuée le 2026-11-03. GitHub l'a refusée :

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml` without `workflows` permission
```

L'APIREST `PUT /contents/.github/workflows/ci.yml` avait déjà renvoyé `403 Resource not accessible by integration` avec `X-Accepted-Github-Permissions: contents=write; contents=write,workflows=write`. **Aucun contournement** par autre jeton, PAT, API ou contournement de permission n'a été utilisé. `gh pr checks 1` ne remonte donc aucun check ; toutes les étapes du workflow ont été exécutées localement avec succès, mais la CI GitHub distante n'est pas active. Les contrôles automatiques réussis sur la PR ne pourront être vérifiés qu'après activation.

### Permission supplémentaire nécessaire

**`workflows: write`** sur l'installation de la GitHub App, en plus de `contents: write` déjà accordée. Il s'agit d'un droit au niveau de l'installation de l'App, pas d'un réglage de dépôt ni d'une option d'agent [3](https://github.com/tuna-os/hive/issues/5). La procédure documentée par GitHub est : GitHub App → *Permissions & events* → *Configure permissions* → *Repository permissions* → **Workflows : Read & write** → *Save changes*, puis réapprouver la modification de permission sur chaque installation concernée [1](https://github.com/orgs/community/discussions/35410).

### Procédure manuelle exacte

1. **Option A — après octroi du droit** : reconnecter l'intégration GitHub dans Arena avec `workflows`, puis me demander de repousser la branche ; je copierai `ci/github-workflow-ci.yml` vers `.github/workflows/ci.yml`, commiterai et pusherai normalement sur `arena/538bb149-rosace`.
2. **Option B — sans attendre le droit, depuis l'interface GitHub** : ouvrir le dépôt → se placer sur la branche `arena/538bb149-rosace` → *Add file* → *Create new file* → chemin `.github/workflows/ci.yml` → coller le contenu de `ci/github-workflow-ci.yml` → committer **directement sur `arena/538bb149-rosace`**, pas sur `main`.
3. **Vérification après activation** : `gh pr checks 1` puis l'onglet *Checks* de la PR #1 doivent afficher les contrôles réussis. Cette vérification n'est pas encore exécutée : l'activation est bloquée par la permission. Je la relancerai dès que le droit sera accordé.

### Parcours couverts dans Chromium

Création de rosace, réglages, annuler/rétablir de recette, curseur Géométrie 1–6 et retour à la corolle, **export/réimport d'un projet Fractale avec progression**, export PNG/SVG/CSV/PDF, **aperçu PDF comparé au SVG motif**, export/réimport projet v2, migration v1 et refus clair, mode Broderie, marquage de croix, annuler/rétablir, zoom, filtres, catalogue 489 fils, fermeture/reprise, `hashchange`/`popstate`/retour-avant, concurrence deux onglets, stockage corrompu / clé v1 / quota, `Échap` avec focus champ, dock bureau, petit écran 390×844, liens legacy.

### Résultats exécutés localement

| Commande | Résultat |
|---|---|
| `npm ci` | 109 paquets installés depuis `package-lock.json` |
| `npm test` | **26 tests réussis** |
| `npm run typecheck` | exit 0 |
| `npm run build` | 2506 modules, `dist/index.html` 753.29 kB / gzip 336.71 kB, singlefile |
| `npm run licenses` | 203 paquets, 8 licences |
| `npm run test:browser` | `Parcours navigateur réussis · /tmp/rosace-browser/artifacts` |
| `npm run test:preview` | `Aperçu de production réussi · http://127.0.0.1:4173` |
| `npm run test:a11y` | **0 violation axe**, 39 passes, 1 `incomplete` décoratif par configuration, 4 configs, 3 exécutions consécutives — **bloquant** |

Commande de référence :
```bash
CHROMIUM_PATH=/tmp/chromium \
LD_LIBRARY_PATH=/tmp/rosace-browser/unpack/lib/lib \
FONTCONFIG_PATH=/tmp/rosace-browser/unpack/fonts \
ARTIFACT_DIR=/tmp/rosace-browser/artifacts \
BASE_URL=http://127.0.0.1:5173 npm run test:browser
```

---

## 5 bis. Enrichissement géométrique

Le curseur **Géométrie** ajoute six familles dans le même `generateRosace`, sans second moteur, sans modification du design validé et sans remplacement de la corolle d'origine :

| Valeur | Famille | Lecture | Croix (réglages communs) |
|---|---|---|---|
| 1 | **Corolle** | rosace d'origine, bit à bit préservée : `353C357F12EC80D5` | 3 381 |
| 2 | **Mandala** | anneaux concentriques, rayons et losanges | 6 193 |
| 3 | **Arabesque** | ogives entrecroisées et festons | 5 145 |
| 4 | **Kaléidoscope** | miroirs en coins, facettes et losanges | 5 697 |
| 5 | **Entrelacs** | trame tissée et nœuds réguliers | 4 621 |
| 6 | **Fractale** | étoile emboîtée à plusieurs échelles | 1 465 |

- Disponible pour **les cinq structures** (6, 8, 10, 12, 14 pétales), les cinq tracés, densités, échelles, tourbillons et ondulations. C'est le sens retenu pour « sous toutes ces formes ».
- `geometry=1` est le défaut : anciens liens `#r=` sans champ `geometry`, projets v1, progressions locales et exports conservent exactement le même patron. La valeur est bornée par `normalizeConfig`.
- Cinq nouvelles études `PRESETS` présentent les familles 2 à 6 ; la fiche PDF, la loupe, les cartes de collection et le nom de recette mentionnent la géométrie.
- Le rendu reste unique : `paintPattern`, la couronne de 489 fils, les exports, l'empreinte et la progression ne sont pas dupliqués.
- Validation : **26 tests réussis**, 30 combinaisons géométrie × structure avec `mirrorSymmetric=true` et `cleaned=0`, 6 empreintes distinctes, tous les curseurs actifs, 11 recettes reproductibles, ancien lien legacy → Corolle, PDF = prévisualisation pour les 6 familles.
- Galerie : [`galerie/index.html`](../galerie/index.html) et `galerie/geometrie-1.png` … `geometrie-6.png`, mêmes paramètres (graine 7, structure 2, tracé 3, densité 3, échelle 3, 101×101), captures réelles du tambour.

Aucune septième famille, aucun fichier de design, aucun moteur géométrique parallèle et aucune licence de code n'ont été ajoutés.

---

## 6. Phase 4 — contrôles préparés, sans bloquer la PR

Exécutés : accessibilité automatisée axe **0 violation**, navigation clavier, réduction des animations, fumage du build servi, inventaire des licences. Rapport détaillé : `QUALITE-PRODUIT.md`.

**Prévus, non exécutés** : Safari / WebKit, Firefox, gestes tactiles réels sur appareil physique, impression papier du PDF, ouverture des exports dans Excel/LibreOffice/logiciel vectoriel, lecteur d'écran, tests terrain avec cinq brodeuses. Les scripts acceptent `BROWSER=firefox|webkit` ; aucun de ces navigateurs n'a été lancé dans cette session.

### Protocole terrain cinq brodeuses — à organiser

| Étape | Contenu |
|---|---|
| Profils | 5 brodeuses : débutante, intermédiaire, confirmée, professionnelle, mobilité/réduction des animations |
| Recettes | 3 recettes : preset par défaut, densité élevée, palette personnalisée |
| Durée | 30 min par personne, appareil personnel si possible |
| Tâches | créer, régler, exporter la fiche, marquer 20 croix, fermer/reprendre, réimporter un projet, utiliser retour/avant |
| Critères | lisibilité des symboles, contraste, taille des cibles tactiles, compréhension de la progression, exactitude perçue du métrage, reprise après interruption |
| Sortie | grille de scores + verbatims + défauts bloquants / non bloquants |

Ce protocole est **prévu**, pas réalisé.

---

## 7. Fichiers modifiés depuis `main`

Depuis `main` : **42 fichiers, 3 334 insertions / 566 suppressions**. Depuis le commit précédent `24cd611` : **23 fichiers, 551 insertions / 130 suppressions**.

| Statut depuis `24cd611` | Fichiers |
|---|---|
| Modifiés | `ci/github-workflow-ci.yml`, `create-ultra-realistic-concept (15)/LICENSES.md`, `NOTICE.md`, `QUALITE-PRODUIT.md`, `RAPPORT-CONSOLIDATION-FINALE.md`, `README.md`, `src/RosaceModule.tsx`, `src/components/Composer.tsx`, `src/components/ZoomStage.tsx`, `src/lib/rosace.ts`, `src/styles/instrument.css`, `src/styles/tokens.css`, `tests/accessibilite.ts`, `tests/parcours-navigateur.ts`, `tests/preview-smoke.ts`, `tests/verify.ts` |
| Ajoutés | `galerie/index.html`, `galerie/geometrie-1.png` … `galerie/geometrie-6.png` |
| Préparé, non poussé | `.github/workflows/ci.yml` (copie locale du workflow, activation refusée faute de permission `workflows`) |

Aucun `LICENSE` applicatif, aucun fichier de design, aucun second moteur géométrique n'a été ajouté ou arbitrairement relicencié.

---

## 8. Limites restantes

- **CI GitHub distante non active** : workflow prêt, permission `workflows` manquante, aucun check affiché sur la PR. Vérification des checks à faire après activation.
- Validation navigateur : Chromium 153 headless, 390×844 et 1280×900 ; Safari, Firefox, appareil réel, lecteur d'écran et multi-touch matériel **préparés mais non exécutés**.
- Les six familles géométriques sont validées en Chromium headless et par 26 assertions, mais pas encore par les cinq brodeuses ni sur appareil réel ; la direction des six noms est validée par l'utilisateur.
- Pincement synthétique sans ancrage au point focal ; `pointercancel` non couvert.
- Couleurs écran indicatives ; métrages, brins, échevettes et temps restent des estimations.
- Lien de partage `#r=` transporte la recette, **pas** la progression.
- Exports PNG/SVG/CSV/PDF et liens sont à sens unique ; seul `.rosace.json` v2 est réimportable.
- PDF validé par pages, texte et comparaison sémantique au SVG, pas par impression physique.
- 1 contrôle axe `incomplete` par configuration sur 2 à 4 séparateurs décoratifs `aria-hidden` ; aucune violation.
- 7 classes CSS inoffensives non référencées (`bouton-large`, `chapeau`, `filet`, `orbe`, `serif-it`, `titre-monumental`, `titre-serif`).
- Protocole cinq brodeuses non exécuté.
- Aucune licence de code décidée.
- Aucun déploiement de production, aucune fusion de PR.

---

## 9. Points exigeant une décision utilisateur

1. **Licence du code applicatif** : choisir parmi les options A–E du §4 avant tout ajout de `LICENSE`. Aucune licence MIT, GPL, Apache ou autre n'a été attribuée.
2. **Permission `workflows`** : accorder `workflows: write` à l'installation GitHub (ou reconnecter l'app avec ce droit), ou activer `.github/workflows/ci.yml` manuellement via la procédure du §5. Ensuite seulement, je pourrai vérifier les contrôles automatiques réussis sur la PR.
3. **Couverture navigateur** : exécuter ou non Safari/Firefox/appareils réels avant fusion ; ils sont préparés, non exécutés.
4. **Validation terrain** : lancer ou non le protocole cinq brodeuses avant fusion.
5. **Fusion et déploiement** : restent interdits jusqu'à validation explicite ; la PR #1 doit rester `OPEN`.
6. **Binaire Chromium en CI** : stratégie actuelle `npx playwright install --with-deps chromium` sur `ubuntu-latest` ; à confirmer si un cache ou un binaire interne est préféré.
7. **Contrôle axe `incomplete`** : accepter les séparateurs décoratifs tels quels ou les rendre totalement invisibles aux outils automatiques, sans changer le design validé.

---

## 10. Conclusion

La version de ROSACE sur `arena/538bb149-rosace` est **conservée sur GitHub, reproductible, testable, stabilisée et prête pour une validation finale**. La PR #1 est ouverte et non fusionnée ; les six corrections prioritaires, les six familles géométriques, la galerie comparative, les 26 tests, les parcours navigateur, le build de production servi et l'accessibilité **0 violation bloquante** sont vérifiés. La corolle d'origine reste bit à bit intacte, le design, le tambour, les outils et la roue chromatique sont conservés. La CI est préparée mais non active faute de permission `workflows` ; les contrôles simplement prévus sont explicitement séparés des contrôles exécutés.

Aucune compilation réussie n'a été présentée comme une validation fonctionnelle. Aucun design validé ni moteur géométrique n'a été modifié sans nécessité démontrée. Aucun déploiement ni fusion n'a eu lieu.
