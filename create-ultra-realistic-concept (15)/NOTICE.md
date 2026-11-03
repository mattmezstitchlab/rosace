# NOTICE — attributions ROSACE

Ce fichier rassemble les mentions requises par les données, polices et dépendances tierces utilisées par ROSACE. **Il n'attribue aucune licence au code applicatif** : ce choix appartient au propriétaire du dépôt et reste volontairement ouvert (voir `RAPPORT-CONSOLIDATION-FINALE.md`).

## Séparation des droits

| Élément | Régime | Conséquence |
|---|---|---|
| **Code applicatif ROSACE** (`src/`, `scripts/`, `tests/`, `ci/`, `galerie/`, rapports) | Aucun `LICENSE`, aucune licence MIT / GPL / Apache / CC attribuée. Tous droits réservés par défaut. | Toute redistribution ou réutilisation du code nécessite une décision explicite du propriétaire. |
| Données DMC (MakeBead) | CC BY 4.0 | Attribution obligatoire, y compris dans les exports. |
| Police Bodoni Moda | OFL 1.1 | Attribution et respect de la licence de police. |
| Dépendances npm | Licences déclarées dans `LICENSES.md` | Chaque paquet reste soumis à sa propre licence. |

Les licences tierces ne s'étendent pas au code ROSACE et ne valent pas choix de licence pour ce code. Aucun fichier `LICENSE` n'a été créé lors de cette revue.

## Données DMC — 489 références

- Œuvre : *craft-color-codes*, jeu de données `data/json/dmc-floss.json`.
- Auteur / éditeur : **MakeBead**.
- Source : <https://github.com/makebead/craft-color-codes>
- Tableau public : <https://makebead.com/dmc-color-chart/>
- Licence des données : **Creative Commons Attribution 4.0 International (CC BY 4.0)** — <https://creativecommons.org/licenses/by/4.0/>
- Licence du code du dépôt amont : MIT.
- Sources croisées déclarées en amont : `floss.maxxmint.com`, `adrianj/CrossStitchCreator`, `xstitchify.com`.
- État déclaré en amont : 489 couleurs *cross-checked*, distinctions Blanc / B5200, correction DMC 309, hex reconstruits depuis les colonnes RVB lorsque la feuille d'origine était endommagée.
- Utilisation locale : `src/data/dmc-reference.json` sert de référence ; `src/data/dmc.ts` conserve les **161 références historiques** de l'application et expose les **489 références** du catalogue. Les codes, noms et hex de la table amont ne sont pas réécrits ; la résolution des anciens codes est insensible à la casse.
- Modifications locales : intégration au catalogue TypeScript, réordonnancement en couronne chromatique, ajout d'un fallback d'affichage et d'une résolution de code ; aucune modification des valeurs chromatiques de la table amont.

Mention courte utilisée dans les exports SVG et la feuille de fournitures :

> Color data: craft-color-codes by MakeBead — CC BY 4.0.

## Police Bodoni Moda

- Paquet : `@fontsource/bodoni-moda`.
- Police : **Bodoni Moda**, licence **SIL Open Font License 1.1** — <https://openfontlicense.org/>.
- Le texte de licence accompagne le paquet dans `node_modules/@fontsource/bodoni-moda/`.

## Dépendances npm

L'inventaire complet, généré depuis `package-lock.json` et les métadonnées installées, se trouve dans `LICENSES.md` (`npm run licenses` pour le régénérer). Il couvre les dépendances directes et transitives, avec leur licence déclarée et leur caractère `dev`. Les textes complets restent dans chaque dossier `node_modules/<paquet>/LICENSE*`.

## Code applicatif

Aucun fichier `LICENSE` n'est ajouté et aucune licence n'est déduite pour le code de ROSACE. Les options et leurs conséquences sont proposées dans le rapport final ; aucune décision n'est prise ici sans accord explicite.
