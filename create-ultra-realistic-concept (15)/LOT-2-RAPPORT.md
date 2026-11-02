# ROSACE — Lot 2 : mode Broderie et consolidation

## 1. État de départ réellement constaté

Le dépôt fourni **ne contient pas `LOT-1-RAPPORT.md`**, ni dossier de tests, ni dossier `studio/motif5d`. Aucun historique Git n'est disponible. Ces éléments du brief ne peuvent donc pas être relus ni validés dans ce dépôt.

Ce qui **est** réellement présent et a été audité :

| Élément | État |
|---|---|
| Moteur ROSACE (`src/lib/rosace.ts`) | Présent, fonctionnel, déterministe |
| Grille canonique et symboles | Présents, cohérents |
| Nuancier DMC historique | 161 fils |
| Exports PNG / SVG / CSV / PDF | Présents |
| Tests | **Absents au départ ; créés dans ce lot** |
| `studio/motif5d`, moteur Point Zéro | **Absent de ce dépôt — non intégré** |

Le mode « 5D » évoqué dans les échanges précédents correspond aux **six réglages du moteur ROSACE** (structure, tracé, densité, échelle, palette, tourbillon/ondulation). Il ne doit pas être confondu avec le moteur historique Point Zéro. Aucun troisième moteur n'a été créé.

## 2. Consolidation des calculs

### Métrage : deux grandeurs distinctes

Une échevette DMC Mouliné est composée de **8 m de fil à 6 brins**, soit **48 m de brins au total**. Broder en 2 brins ne donne que **24 m de faisceau utilisable** dans une échevette.

Le moteur distingue désormais :

- `meters` : **longueur du faisceau enfilé**, marge comprise ;
- `strandMeters` : **somme de tous les brins individuels**, marge comprise ;
- `skeins` : **échevettes commerciales**, arrondies au supérieur, une minimum par couleur utilisée ;
- `skeinUsableNeedleMeters` : longueur utile d'un faisceau dans une échevette pour le nombre de brins choisi.

Hypothèse de longueur par croix : **2,5 cm pour 2 brins sur Aïda 14**, modulée par `14 / comptage` et par `brins / 2`, plus une marge de sécurité paramétrable (0–50 %, 15 % par défaut). Ce n'est pas une donnée officielle DMC. La tension, les arrêts et le cheminement au dos varient. Ces limites figurent dans l'interface et dans la fiche imprimée.

### Temps

L'ancienne formule supposait environ 840 croix/h, très optimiste. Le calcul affiche désormais une **plage** : 100–200 croix/h, surcoût de 40 %, plus 15–25 min de préparation. La recette par défaut de 3 381 croix est annoncée autour de **24–48 h**, au lieu de 4,3 h. Ce sont des repères de planification, pas une mesure individuelle.

### Brins et Aïda

Le nombre de brins (1 à 6) et la marge sont des **paramètres textiles** : ils modifient le métrage et le temps, jamais la géométrie. Changer Aïda change les dimensions physiques et la consommation ; changer les brins change la consommation, pas les croix.

## 3. PDF : défaut corrigé et testé

L'ancienne découpe divisait la grille en quatre carrés. Sur une grille impaire, par exemple 101 × 101, la dernière ligne de la moitié droite n'appartenait à aucune planche : **46 croix manquaient** pour la recette par défaut.

La nouvelle découpe utilise des **rectangles exacts** (`src/lib/chart.ts`), sur deux colonnes et deux lignes complémentaires. La zone imprimée couvre chaque croix une et une seule fois. Le test `planches : chaque croix apparaît exactement une fois` vérifie toutes les tailles de grille utilisées (81 à 121) et la recette réelle.

Le PDF produit ensuite **cinq pages** : une page de fournitures, puis quatre planches. Les coordonnées imprimées vont de 1 à 51 puis de 52 à 101, sans trou.

## 4. Mode Broderie

Le mode est ouvert par l'outil **Broder** du dock. Il affiche la grille réelle du patron canonique, pas une seconde représentation.

Fonctions livrées :

- déplacement par glissement, zoom par pincement et boutons, molette + Ctrl sur ordinateur ;
- sélection d'un fil DMC, mise en évidence de ses seules croix ;
- filtre « Restants » ;
- cochage et décochage d'une croix par appui, ou au clavier (flèches + Espace/Entrée) ;
- croix restantes, par fil et pourcentage ;
- annuler et rétablir, avec journal persistant ;
- mémorisation de la dernière position, du fil choisi et de la progression ;
- reprise après fermeture ou rechargement ;
- export et import de projet JSON.

**Le patron reste immuable.** La progression est stockée sous une empreinte de grille et de fils (`pattern-id.ts`). La toile, l'Aïda, les brins et la marge ne changent pas l'empreinte, car ils ne changent pas les croix.

## 5. Preuves

### Tests automatisés

`npm test` exécute 12 tests reproductibles :

1. catalogue : 489 références, codes uniques, 161 historiques intactes ;
2. métrage : faisceau et brins distincts, échevettes arrondies ;
3. conversions Aïda : 14 > 16 > 18 en consommation par croix, brins proportionnels ;
4. temps : plage réaliste, hypothèse affichée ;
5. déterminisme : mêmes réglages et graine → même matrice et même empreinte ;
6. empreinte stable malgré Aïda et brins, changement avec la palette ;
7. planches : couverture exacte, sans chevauchement, grilles impaires comprises ;
8. six recettes reproductibles et cohérentes ;
9. sérialisation compacte de la progression et bijection ;
10. import de projet accepté seulement si l'empreinte et les indices sont valides ;
11. restants par fil = total moins cases cochées ;
12. aucune régression sur les réglages existants.

### Navigateur

Parcours testé dans Chromium, vue mobile 390 × 844 :

- ouverture du mode Broder sur la recette existante ;
- marquage de croix, passage à 2/3 381 ;
- annulation, rétablissement, puis rechargement : état conservé ;
- sélection d'un fil : les autres croix sont visuellement masquées ;
- zoom ×1,56 par boutons ;
- export de projet : format, version 2, empreinte de 16 caractères, recette et progression présentes ;
- import : notification de succès, progression restaurée.

### Exports

- **CSV** : ligne par fil avec longueur de brins, longueur aiguille et échevettes, plus une ligne « Total » marquée pour ne pas être confondue avec un fil.
- **Projet JSON** : recette exacte, empreinte, progression, fil choisi, vue et journal d'annulation.
- **PNG** : 1 600 × 1 600.
- **SVG** : symboles et coordonnées compris.
- **PDF** : cinq pages, références DMC et symboles présents, planches sans trou.

## 6. Palette DMC

Le catalogue passe de 161 à 489 références sans retirer ni renommer les 161 existantes. Les 328 ajouts viennent de la source ouverte **MakeBead craft-color-codes**, statut *cross-checked*, licence **CC BY 4.0**.

Provenance, attribution et limites de rendu : voir `DMC-SOURCES.md`. Les valeurs restent des approximations d'écran ; les bains de teinture et la lumière peuvent différer.

## 7. Moteur 5D historique — non intégré

La source publique identifiable est le dépôt **`mattmezstitchlab/POINTZERO`**, décrit notamment comme un atelier dont le motif est un tableau typé avec un noyau `pattern.ts`, une sérialisation stable par codes DMC et une définition unique des symboles. Aucune copie de ce code, aucune dépendance et aucun test ne sont présents dans ce dépôt.

En conséquence :

- **aucune fusion n'est affirmée** ;
- aucun troisième moteur n'a été créé ;
- le mode présenté ici est le moteur ROSACE existant, pas Point Zéro.

Une intégration réelle exige l'accès au dépôt et à ses tests, puis une décision de licence et de compatibilité de format.

## 8. Limites restantes

- Pas de test sur Safari, Firefox, appareil physique ni lecteur d'écran réel.
- Le pincement est validé par événements de pointeur / émulation tactile, pas par cinq appareils.
- La progression est locale au navigateur (localStorage), dans une seule origine. Pas de synchronisation cloud.
- L'import refuse toute empreinte différente, y compris pour un patron volontairement modifié : il faut alors créer une nouvelle progression.
- Les estimations textiles et de temps restent des estimations, signalées comme telles.
- Aucune brodeuse n'a encore brodé un ouvrage complet dans le cadre de ce lot.

## 9. Protocole de validation auprès de cinq brodeuses

Recruter cinq profils : une débutante, deux intermédiaires, une expérimentée, une créatrice qui vend ou envisage de vendre des patrons. Faire lire et signer une autorisation courte d'usage des retours, sans collecte de données personnelles inutile.

**Séance 1 — créer (45 min).** Chaque participante part de la recette par défaut. Elle choisit un fil, ajuste un réglage, vérifie le nombre de croix et les dimensions, enregistre dans la collection et exporte le PDF. Observer, sans aider pendant les cinq premières minutes, les hésitations et erreurs.

**Séance 2 — vérifier le patron (20 min).** Comparer le PDF imprimé et la grille à l'écran. Contrôler que les totaux par fil et le total général concordent, et que chaque planche a des coordonnées continues. Noter toute ambiguïté de symbole ou de légende.

**Séance 3 — broder un extrait (2 h).** Choisir une zone de 20 × 20 croix contenant au moins trois fils. Imprimer la zone. Broder en suivant les symboles. Chronométrer, noter les erreurs de comptage, les changements de fil et les difficultés de lecture.

**Séance 4 — suivre dans ROSACE (30 min).** Ouvrir le mode Broder, sélectionner un fil, cocher les croix de l'extrait, fermer l'application, rouvrir et vérifier la reprise. Faire aussi un import de projet sur un second appareil si possible.

**Mesures communes**

| Mesure | Méthode |
|---|---|
| Lisibilité de la grille | 1 (illisible) à 5 (très facile), par symbole et par couleur |
| Fidélité du PDF | nombre de croix manquantes ou ambiguës, comparaison avec la matrice |
| Erreurs de comptage | croix mal placées / total de croix brodées |
| Temps par croix | minutes mesurées ÷ croix brochées |
| Fil réellement consommé | longueur de fils utilisés, comparée à l'estimation ROSACE |
| Reprise | progression exacte après fermeture / réouverture |
| Compréhension du mode | tâches réussies sans aide |

**Critères d'acceptation proposés** : aucune croix manquante sur toutes les planches ; toutes les participantes retrouvent leur progression ; au moins quatre sur cinq arrivent à cocher, annuler et reprendre sans aide ; aucun blocage de stockage non expliqué ; écarts de fil signalés et compris comme des estimations.

**Livrables de la validation** : fiches d'observation anonymisées, photos des ouvrages, extrait brodé ou terminé, relevé des temps et difficultés, liste priorisée des corrections. Aucun de ces éléments n'existe encore : ce protocole est à exécuter, pas un résultat.

## 10. Fichiers modifiés ou ajoutés

- **Ajoutés** : `src/lib/materials.ts`, `src/lib/chart.ts`, `src/lib/pattern-id.ts`, `src/lib/progress.ts`, `src/components/EmbroideryView.tsx`, `src/styles/broder.css`, `tests/verify.ts`, `LOT-2-RAPPORT.md`, `DMC-SOURCES.md`, `src/data/dmc-reference.json`.
- **Modifiés** : `src/lib/rosace.ts` (métrage, temps, brins, empreinte de grille), `src/lib/exporters.ts` (planches, projet, provenance), `src/data/dmc.ts` (extension compatible), `src/data/crown.ts`, `src/lib/harmony.ts`, `src/state/rosace-store.tsx` (mode Broder), `src/components/Composer.tsx`, `src/components/Panels.tsx` (brins, marge, projet, métriques), `src/components/Disque.tsx`, `src/RosaceModule.tsx`, `src/index.css`, `package.json` (script `test`).
- **Retiré** : `src/components/GridPanel.tsx`, remplacé par le mode Broderie. Le mode Grille n'existe plus comme vue séparée : la grille technique est intégrée au mode Broder.
