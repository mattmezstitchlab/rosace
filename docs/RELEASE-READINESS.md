# ROSACE — Préparation de la version utilisable (8 novembre 2026)

## Situation

- Application React/TypeScript + Vite dans `create-ultra-realistic-concept (15)/`.
- Ce chantier protège le moteur existant : `generateRosace`, `StitchWork`, les recettes et empreintes historiques, les 489 couleurs DMC, la broderie et les exports ne sont pas modifiés.
- Une validation GitHub Actions est installée dans `.github/workflows/rosace.yml`. Elle s'exécute sur les pull requests vers `main` et les branches `main`, `arena/**`, `chatgpt/**`.
- `npm run test:all` démarre désormais les serveurs de développement et de prévisualisation nécessaires et exécute les vérifications d'accessibilité, en plus des tests, du typecheck et de la compilation.
- La dernière exécution GitHub Actions observée le 8 novembre 2026 sur `main` est réussie. Le découpage récent du chargement a été vérifié localement ; la CI doit encore s'exécuter sur le commit qui le contient.

## Contrôles indispensables avant fusion

- [ ] La dernière exécution GitHub Actions de la PR est **verte** (tests, typecheck, build, licences, parcours navigateur, accessibilité et build servi).
- [ ] Le projet a été vérifié dans un navigateur Firefox et Safari/WebKit, pas seulement Chromium headless.
- [ ] Un smartphone physique a été utilisé pour valider la couronne DMC, les gestes tactiles, l'import et la progression.
- [ ] Les exports PNG, SVG, PDF et CSV ont été ouverts et contrôlés sur des appareils courants.
- [ ] Au moins trois patrons PDF de provenance autorisée ont été importés ; les points que le moteur ne prend pas en charge sont signalés à l'écran.
- [ ] Un test de bout en bout a été réalisé par plusieurs brodeuses (compréhension, création, lecture du diagramme et reprise de progression).
- [ ] Le statut juridique du code et les crédits des données de couleurs et polices sont vérifiés.
- [ ] L'hébergement final, le nom de domaine, les mentions légales, la confidentialité et les sauvegardes éventuelles sont configurés et validés.

## Périmètre de la V1 proposée

**À conserver** : quatre entrées de création (rosace, photo, texte, PDF), atelier de composition, couleurs DMC, conversion en patron, exports, bibliothèque locale, progression de broderie.

**À ne pas ajouter immédiatement** : comptes utilisateur, boutique multifournisseur, réseau social, paiement intégré, abonnements, IA payante, nouveaux moteurs de géométrie, collaboration temps réel entre appareils (elle demande un serveur ; « Broder ensemble » ne relie aujourd'hui que les onglets d'un même navigateur). Un parcours de vente nécessitera une décision commerciale et la validation de la sécurité et des obligations réglementaires.

## Audit avant publication (8 novembre 2026)

Balayages navigateur et trois relectures de code (moteur, import/export, interface). **Corrigé** :

- **Landing** : survol des boutons (texte blanc sur fond clair), focus visible sur les fonds sombres, code mort retiré.
- **Broder ensemble** : la session ne voyait personne (identifiant partagé entre onglets). Chaque page a son identifiant, les messages reçus sont validés, les curseurs sont nommés et lisibles à tout zoom, « Quitter » est immédiat. Tests : `tests/live.ts`, `tests/broder-navigateur.ts` (Chromium, Firefox 157 et WebKit 27.2).
- **Fichiers hostiles** : une liste de croix `1e21` figeait l'onglet ; un projet v3 piégé injectait du HTML dans la fiche imprimable ou provoquait un écran blanc ; les cellules CSV commençant par `=`, `+`, `-` ou `@` sont neutralisées. Tests : `tests/robustesse.ts`.
- **Données** : ouvrir un lien `#r=` ne supprime plus le patron importé, le retirer demande une confirmation, une progression non enregistrée est annoncée à la fermeture.
- **Import PDF** : pdf.js compatible avec les navigateurs plus anciens, abandon possible pendant l'analyse, 100 pages au plus, champs numériques sans saisie bloquée.
- **Moteur** : « Û » n'est plus un « O » ; apostrophes, guillemets et « œ » des claviers mobiles sont reconnus ; le métrage « aiguille » ne dépend plus du nombre de brins (le réglage par défaut, 2 brins, donne exactement les mêmes chiffres) ; un total exact de 48 m ne réclame plus une échevette de plus.
- **Interface** : écran de secours et rechargement unique après un déploiement, lien d'évitement, notifications au-dessus de tout, molette sans zoom de page, libellés mobiles lisibles, titre par vue, métadonnées de partage.

**Reste à décider ou à faire** :

- **Teintes DMC** : 11 des 161 références historiques s'écartent de `dmc-reference.json` de plus de ΔE 10 ; catalogue non modifié.
- **Empreinte** (32 bits effectifs) et rare asymétrie miroir : invariants conservés, non modifiés.
- **Collaboration entre appareils** : à ce jour, passer par « Projet » puis « Importer calque ». Une vraie session distante demande un serveur (Cloudflare Worker et Durable Object).
- **Licence du code**, mentions légales et confidentialité : aucun fichier `LICENSE`.
- **En-têtes de sécurité** (CSP) : non ajoutés, à tester avec le worker pdf.js avant activation.
- **Dépendances de développement** : `vite` 7.3.2 → 7.3.7 corrige des avis qui ne touchent pas le site publié (`npm audit --omit=dev` : 0 vulnérabilité).
- **Accessibilité** : axe signale encore, dans la vue Broder (hors du périmètre de `test:a11y`) et sur l'étape « Analyser » de l'import, des libellés qui ne reprennent pas le texte visible, et un second repère `banner`.
- **Non traité (priorité basse)** : pièges de focus des boîtes de dialogue, messages d'erreur PDF encore en partie en anglais, ressources de la conversion photo, bornes de la rectification d'image.

## Commandes

Depuis `create-ultra-realistic-concept (15)/` :

```bash
npm ci
npm run test:all
```

La validation comprend désormais le démarrage automatique de Vite sur les ports locaux 5173 et 4173. Ces ports doivent être libres. Les tests navigateur nécessitent l'installation de Chromium pour Playwright ; la CI s'en charge avec `npx playwright install --with-deps chromium`.

## Limites connues

- Le rapport produit historique décrit des tests Chromium exécutés, mais ne remplace pas la vérification de la dernière CI.
- L'import PDF ne prend pas en charge tous les types de points ; il signale les pertes connues.
- Les métrages de fil, durées et couleurs écran sont des estimations.
- Les fonctions de paiement et de publication commerciale ne sont pas intégrées par cette préparation.
- Aucune modification de production ni fusion vers `main` n'est effectuée ici.
