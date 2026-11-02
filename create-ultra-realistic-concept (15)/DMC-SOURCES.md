# ROSACE — provenance des couleurs DMC

## Ce qui est livré

- **161 références historiques ROSACE** : codes, noms français et valeurs d'écran conservés à l'identique. Aucun code n'est supprimé, renommé ni remplacé par l'extension.
- **328 références ajoutées** depuis la source ouverte, pour atteindre **489 codes**.
- Les doublons sont écartés sans tenir compte de la casse (`BLANC`/`Blanc`, `ECRU`/`Ecru`). En cas de conflit, la fiche historique reste prioritaire.
- Les codes inconnus ou absents du référentiel de base ne sont jamais silencieusement réécrits.

Fichier de données : `src/data/dmc.ts` + `src/data/dmc-reference.json`.

## Source retenue

**MakeBead — craft-color-codes**, fichier `data/json/dmc-floss.json` :
<https://github.com/makebead/craft-color-codes/blob/main/data/json/dmc-floss.json>

- 489 couleurs DMC Six-Strand Embroidery Floss (Mouliné Spécial, art. 117).
- Statut déclaré par l'éditeur : *cross-checked* — recoupé entre plusieurs sources, les conflits étant arbitrés par une règle écrite.
- Licence des données : **CC BY 4.0**. Attribution : « Color data: craft-color-codes by MakeBead, https://makebead.com ».
- La source précise que les valeurs hexadécimales sont des **approximations**, pas des mesures colorimétriques des fils.

## Limites de rendu — à lire avant de commander

1. Un écran émet de la lumière ; un fil réfléchit la lumière ambiante. Aucun hexadécimal ne reproduit un coton teint sous une lampe donnée.
2. Les bains de teinture varient d'une série à l'autre pour un même numéro. Deux échevettes achetées séparément peuvent différer légèrement.
3. DMC ne publie pas de table RGB officielle, exploitable telle quelle. Les valeurs de la source sont reconstruites et recoupées, non officielles.
4. Les 161 fiches historiques ROSACE conservent leurs propres hex et noms français. Certains diffèrent du référentiel : par exemple `353` est conservé sous « Corail très clair » côté ROSACE, alors que le référentiel le nomme « Peach », avec une valeur d'écran différente. Ces écarts sont documentés, pas corrigés en silence, pour ne pas changer les recettes existantes.
5. Les écarts ne sont **pas** une preuve que l'un ou l'autre est faux : seul un nuancier physique DMC tranche.

## Règle de compatibilité

Un lien de partage, un favori ou un projet importé qui référence une couleur est toujours résolu par son **code DMC**. L'extension du catalogue n'altère ni les recettes existantes ni les symboles de la grille : les cinq premières couleurs d'une recette gardent le même indice et le même symbole. L'ajout de références ne fait qu'augmenter l'ensemble des choix disponibles.

## Ce qui n'est pas garanti

- La correspondance perceptuelle entre la couleur d'écran et l'échevette réelle.
- L'identité des noms entre la fiche historique ROSACE et le catalogue MakeBead.
- La disponibilité commerciale de chaque référence : le catalogue décrit une gamme de fils, pas un stock.
