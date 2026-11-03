# ROSACE — rapport de consolidation finale

> Une seule application ROSACE. Une seule source de vérité. Un seul ouvrage, de sa création à sa réalisation.

Ce document est le **seul rapport applicatif** de la branche. Les anciens rapports `ATLAS-INTEGRATION.md`, `DMC-SOURCES.md` et `LOT-2-RAPPORT.md` ont été supprimés ; ce fichier les remplace. Les contrôles qualité exécutés / prévus sont détaillés dans `QUALITE-PRODUIT.md`, sans créer de second rapport de consolidation.

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

La PR #1 n'est **pas fusionnée**, `mergedAt=null`, `closedAt=null`, `mergeable=MERGEABLE`. **Aucun déploiement** n'a été effectué.

---

## 2. Consolidation canonique déjà livrée

- Un seul moteur `generateRosace` dans `src/lib/rosace.ts`, un seul `RosaceProvider`, un seul rendu de matrice `paintPattern` partagé entre le tambour et la Broderie.
- Un seul point d'entrée projet/progression : `src/lib/progress.ts`.
- Suppression des doublons, validateurs divergents, hook mort `src/lib/useMediaQuery.ts`, CSS morts et trois rapports périmés.
- **Préservés** : le design validé, la couronne de 489 fils, l'ergonomie mobile, les exports, les raccourcis et les 489 références DMC.
- Vérifications invariants : 101×101, **3 381 croix**, empreinte `353C357F12EC80D5`, 161 + 328 = 489 références, `missingFromRef=[]`, PDF 5 pages, PNG 1600².

Aucune modification du design validé ni du moteur géométrique n'a été faite après `d281aa8` sans nécessité démontrée.

---

## 3. Phase 1 — corrections prioritaires, toutes implémentées et vérifiées

| Correction | Implémentation | Vérification |
|---|---|---|
| 1. Navigation `hashchange`, `popstate`, retour/avant, liens de recettes | `applyLocationRecipe`, `replaceState`, listeners `hashchange` et `popstate` dans `src/state/rosace-store.tsx` ; recette appliquée sans polluer l'historique | `npm run test:browser` |
| 2. Progression concurrente entre onglets sans écrasement silencieux | `saveProgress(progress, base)` + `reconcileProgress(remote, local, base)` ; `EmbroideryView.tsx` conserve `baseProgressRef`, `liveRef`, `suppressSaveRef` et écoute `storage` | tests 19–23 + parcours deux onglets |
| 3. Import anciens projets / progressions v1 | `migrateProjectV1`, `loadLegacyProgress`, `migrateLegacyProgressRecord` ; toast « Projet version 1 migré » ; refus clair si empreinte inconnue | tests 20–22 + parcours navigateur |
| 4. `Échap` ferme les panneaux même avec focus dans un champ | garde déplacée avant le test `INPUT`/`TEXTAREA` dans `src/components/Composer.tsx` | parcours focus `input[type=range]` + `Échap` |
| 5. Stockage corrompu et quota dépassé | `loadPatternProgress` nettoie les données invalides ; `saveProgress` capture les `DOMException` ; l'application reste utilisable et notifie | tests 23 + parcours quota simulé |
| 6. Build de production réellement servi | `tests/preview-smoke.ts` exécuté contre `npm run preview` sur le port 4173 | `npm run test:preview` exit 0 |

Détails : clé canonique `aime-rosace-progress-v2:<empreinte>` ; anciennes clés `aime-rosace-progress-v1:`, `aime-rosace-progress:`, `rosace-progress-v1:` ; `PROJECT_FORMAT="rosace-project"` ; `PROJECT_VERSION=2` ; `clampViewport` 0.8–8 ; `buildProject` nettoie aussi progression, journal et vue.

**Défauts corrigés au passage** : `TS2367` sur `probe.version`, assertion de sélection v1 inconnue, `closePanel` rendu idempotent, titre erroné et fuite de Chromium dans le script de fumage, anciens défauts d'I/O projet / journal et `TS6133`.

---

## 4. Phase 2 — README, NOTICE, licences

- `README.md` : concept, installation, commandes, architecture, formats d'export, progression, limites.
- `NOTICE.md` : attribution MakeBead `craft-color-codes` / DMC **CC BY 4.0** (489 références cross-checkées, Blanc/B5200, DMC 309, hex RVB, modifications locales) et Bodoni Moda **OFL 1.1**.
- `scripts/inventaire-licences.mjs` + `npm run licenses` → `LICENSES.md` généré le `2026-11-03T02:48:22.268Z` : **203 paquets, 8 licences distinctes** — MIT 173, MPL-2.0 14, ISC 7, Apache-2.0 5, OFL-1.1 1, CC-BY-4.0 1, BSD-3-Clause 1, 0BSD 1.
- **Aucune licence de code applicatif n'a été attribuée.** Le dépôt reste `license=null`, conformément à la consigne explicite.

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

Le workflow est fourni dans `ci/github-workflow-ci.yml`. Une fois copié vers `.github/workflows/ci.yml` avec la permission `workflows`, il exécute sur chaque PR vers `main` et chaque push sur la branche :

1. `npm ci --no-audit --no-fund` ;
2. `npm test` ;
3. `npm run typecheck` ;
4. `npm run build` ;
5. `npm run licenses` ;
6. `npx playwright install --with-deps chromium` ;
7. `npm run test:browser` et `npm run test:a11y` sur `npm run dev` ;
8. `npm run test:preview` sur `npm run preview` ;
9. upload des artefacts.

`npm run test:a11y` est explicitement **non bloquant** ; les autres contrôles font échouer la CI. Le workflow distingue bien la compilation de la validation fonctionnelle : les parcours navigateur et le fumage du build servi sont obligatoires.

**État distant de la CI** : le token de l'intégration GitHub de cette session n'a pas la permission `workflows` (`git push` refusé, API `contents` en `403 Resource not accessible by integration`). Le fichier n'a donc pas pu être activé sous `.github/workflows/` depuis l'agent ; il est livré dans `ci/github-workflow-ci.yml`, prêt à être copié après octroi de la permission ou dépôt manuel. **Toutes les étapes ci-dessus ont été exécutées localement avec succès**, mais la CI GitHub distante n'est pas encore active.

### Parcours couverts dans Chromium

Création de rosace, réglages, annuler/rétablir de recette, export PNG/SVG/CSV/PDF, export/réimport projet v2, migration v1 et refus clair, mode Broderie, marquage de croix, annuler/rétablir, zoom, filtres, catalogue 489 fils, fermeture/reprise, `hashchange`/`popstate`/retour-avant, concurrence deux onglets, stockage corrompu / clé v1 / quota, `Échap` avec focus champ, dock bureau, liens legacy.

### Résultats exécutés localement

| Commande | Résultat |
|---|---|
| `npm ci` | 109 paquets installés depuis `package-lock.json` |
| `npm test` | **23 tests réussis** |
| `npm run typecheck` | exit 0 |
| `npm run build` | 2506 modules, `dist/index.html` 749.47 kB / gzip 335.58 kB, singlefile |
| `npm run licenses` | 203 paquets, 8 licences |
| `npm run test:browser` | `Parcours navigateur réussis · /tmp/rosace-browser/artifacts` |
| `npm run test:preview` | `Aperçu de production réussi · http://127.0.0.1:4173` |
| `npm run test:a11y` | 2 violations axe sérieuses, 37 passes, 1 incomplet, clavier et `prefers-reduced-motion` validés — non bloquant |

Commande de référence :
```bash
CHROMIUM_PATH=/tmp/chromium \
LD_LIBRARY_PATH=/tmp/rosace-browser/unpack/lib/lib \
FONTCONFIG_PATH=/tmp/rosace-browser/unpack/fonts \
ARTIFACT_DIR=/tmp/rosace-browser/artifacts \
BASE_URL=http://127.0.0.1:5173 npm run test:browser
```

---

## 6. Phase 4 — contrôles préparés, sans bloquer la PR

Exécutés : accessibilité automatisée axe, navigation clavier, réduction des animations, fumage du build servi, inventaire des licences. Rapport détaillé : `QUALITE-PRODUIT.md`.

**Prévus, non exécutés** : Safari / Firefox, gestes tactiles réels sur appareil physique, impression papier du PDF, ouverture des exports dans Excel/LibreOffice/logiciel vectoriel, lecteur d'écran, tests terrain avec cinq brodeuses, correction des 2 violations axe.

Les 2 violations axe documentées : `color-contrast` (1 nœud) et `label-content-name-mismatch` (7 nœuds). Elles ne sont pas corrigées ici pour ne pas altérer le design validé sans décision explicite.

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

32 fichiers : **2 568 insertions / 542 suppressions**, rapport final inclus.

| Statut | Fichiers |
|---|---|
| Ajoutés | `ci/github-workflow-ci.yml` (workflow à activer), `.gitignore`, `LICENSES.md`, `NOTICE.md`, `QUALITE-PRODUIT.md`, `RAPPORT-CONSOLIDATION-FINALE.md`, `README.md`, `scripts/inventaire-licences.mjs`, `tests/accessibilite.ts`, `tests/parcours-navigateur.ts`, `tests/preview-smoke.ts` |
| Supprimés | `ATLAS-INTEGRATION.md`, `DMC-SOURCES.md`, `LOT-2-RAPPORT.md`, `src/lib/useMediaQuery.ts` |
| Modifiés | `package-lock.json`, `package.json`, `src/components/Composer.tsx`, `Disque.tsx`, `EmbroideryView.tsx`, `Loupe.tsx`, `Panels.tsx`, `src/data/dmc.ts`, `src/lib/exporters.ts`, `progress.ts`, `rosace.ts`, `src/state/rosace-store.tsx`, `src/styles/dialogues.css`, `instrument.css`, `tests/verify.ts`, `tsconfig.json`, `vite.config.ts` |

Aucun `LICENSE` applicatif, aucun fichier de design, aucun fichier du moteur géométrique n'a été ajouté ou arbitrairement relicencié.

---

## 8. Limites restantes

- Validation navigateur : Chromium 153 headless, 390×844 et 1440×900 ; pas Safari, Firefox, appareil réel, lecteur d'écran ni multi-touch matériel.
- Pincement synthétique sans ancrage au point focal ; `pointercancel` non couvert.
- Couleurs écran indicatives ; métrages, brins, échevettes et temps restent des estimations.
- Lien de partage `#r=` transporte la recette, **pas** la progression.
- Exports PNG/SVG/CSV/PDF et liens sont à sens unique ; seul `.rosace.json` v2 est réimportable.
- PDF validé par nombre de pages et texte, pas par impression physique.
- 7 classes CSS inoffensives non référencées (`bouton-large`, `chapeau`, `filet`, `orbe`, `serif-it`, `titre-monumental`, `titre-serif`).
- 2 violations axe non bloquantes non corrigées.
- Protocole cinq brodeuses non exécuté.
- Aucune licence de code décidée.
- Aucun déploiement de production, aucune fusion de PR.

---

## 9. Points exigeant une décision utilisateur

1. **Licence du code applicatif** : choisir parmi les options A–E du §4 avant tout ajout de `LICENSE`.
2. **Violations axe** : corriger maintenant ou les accepter comme dette non bloquante avant validation terrain.
3. **Couverture navigateur** : ajouter Safari/Firefox/appareils réels à la CI ou les garder en validation manuelle.
4. **Validation terrain** : lancer ou non le protocole cinq brodeuses avant fusion.
5. **Fusion et déploiement** : rester interdits jusqu'à validation explicite ; la PR #1 doit rester `OPEN`.
6. **Binaire Chromium en CI** : stratégie actuelle `npx playwright install --with-deps chromium` sur `ubuntu-latest` ; à confirmer si un cache ou un binaire interne est préféré.
7. **Permission `workflows`** : accorder ce droit à l'intégration GitHub (ou reconnecter l'app) pour que je puisse copier `ci/github-workflow-ci.yml` vers `.github/workflows/ci.yml` et activer la CI distante ; sinon le faire manuellement depuis l'interface GitHub.

---

## 10. Conclusion

La version de ROSACE sur `arena/538bb149-rosace` est **conservée sur GitHub, reproductible, testable et prête pour une validation finale**. La sauvegarde est prouvée, la PR #1 est ouverte et non fusionnée, les six corrections prioritaires sont vérifiées dans un navigateur, le build de production est fumé, la documentation est en place, la CI est préparée en attendant la permission `workflows`, et les contrôles simplement prévus sont explicitement séparés des contrôles exécutés.

Aucune compilation réussie n'a été présentée comme une validation fonctionnelle. Aucun design validé ni moteur géométrique n'a été modifié sans nécessité démontrée. Aucun déploiement ni fusion n'a eu lieu.
