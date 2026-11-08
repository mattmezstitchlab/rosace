# ROSACE — Préparation de la version utilisable (8 novembre 2026)

## Situation

- Application React/TypeScript + Vite dans `create-ultra-realistic-concept (15)/`.
- Ce chantier protège le moteur existant : `generateRosace`, `StitchWork`, les recettes et empreintes historiques, les 489 couleurs DMC, la broderie et les exports ne sont pas modifiés.
- Une validation GitHub Actions est installée dans `.github/workflows/rosace.yml`. Elle s'exécute sur les pull requests vers `main` et les branches `main`, `arena/**`, `chatgpt/**`.
- `npm run test:all` démarre désormais les serveurs de développement et de prévisualisation nécessaires et exécute les vérifications d'accessibilité, en plus des tests, du typecheck et de la compilation.

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

**À ne pas ajouter immédiatement** : comptes utilisateur, boutique multifournisseur, réseau social, paiement intégré, abonnements, IA payante, nouveaux moteurs de géométrie, collaboration temps réel. Un parcours de vente nécessitera une décision commerciale et la validation de la sécurité et des obligations réglementaires.

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
