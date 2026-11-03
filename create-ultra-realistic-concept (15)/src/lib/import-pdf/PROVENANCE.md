# Noyau d'import PDF — provenance

Copie contrôlée du moteur d'import et de recomposition de grilles PDF de **Point Zéro**.

- Dépôt source : `mattmezstitchlab/pointzero-rosaces-prive`, branche `rosaces`, commit `c3db80f869a82a3279f80d461a0f19444144b285` (29 octobre 2026), dossier `studio/src/`.
- Licence du source : MIT (Matt Mez Stitch Lab et les contributeurs de Point Zéro, 2026).
- Date de la copie : 3 novembre 2026, branche `cristallisation/stitchwork` de ROSACE.

Règle : les corrections se font ici, dans ROSACE, et sont prouvées par `tests/import-pdf.ts`. Elles peuvent être reportées vers Point Zéro ensuite, pas l'inverse pendant la mission.

| Fichier ROSACE | Source Point Zéro | État |
| --- | --- | --- |
| `pdfimport.ts` | `lib/pdfimport.ts` | copie identique (couche pdf.js, import dynamique, worker `?url`) |
| `pdfVector.ts` | `lib/pdfVector.ts` | copie identique, import `./dmc` → `./floss` |
| `pdfGlyphChart.ts` | `lib/pdfGlyphChart.ts` | copie identique, import `./dmc` → `./floss` |
| `pdfAnalysis.ts` | `lib/pdfAnalysis.ts` | copie identique, imports `./dmc` → `./floss`, `./chartRecognition` → `./rectify` |
| `rectify.ts` | `lib/chartRecognition.ts` (`homography`, `rectify` seulement) | extrait ; `detectGrid` et la reconnaissance raster d'ImportStudio ne sont pas repris |
| `quantize.ts` | `lib/quantize.ts` | copie, le type `ConvertOptions` de `convert.ts` devient `QuantizeOptions` local |
| `floss.ts` | `lib/dmc.ts` + `lib/colorScience.ts` (`deltaE2000`) | **réécrit** : `FLOSS` est construit depuis `src/data/dmc.ts` (même source MakeBead, 489 codes) ; pas de `registerBlend` (les mélanges sont comptés dans les pertes) ; pas de recherche en français (ROSACE a la sienne) |
| `montage.ts` | `components/PdfPrep.tsx` (`positionsPuzzle`, aimantation du glisser, `assembleFromTileLayout`) | **extrait et corrigé** : une tuile porte ses propres `cols/rows` (bug des tuiles glyphes recalées) ; l'aimantation choisit la cible la plus proche ; recouvrements, conflits et trous comptés |
| `grid.ts` | `lib/pdfColorImport.ts` (`patternFromVector`, `remapImportedPalette`, `closestDmcAlternatives`) | **réécrit** pour produire un `ImportedGrid` (palette locale) au lieu d'un `Pattern` Point Zéro |

Non repris, volontairement : `lib/pattern.ts`, `lib/symbols.ts`, `lib/motif5d/`, `lib/photoSource.ts`, `components/ImportStudio.tsx`, le store du studio, `jspdf`.

Dépendance ajoutée à ROSACE : `pdfjs-dist` 6.4.299 (Apache-2.0), version figée comme dans Point Zéro.

Tests portés : `__tests__/pdfPuzzle.test.ts`, `pdfDmcImport.test.ts`, `pdfCompleteGlyph.test.ts` → `tests/import-pdf.ts` (assertions Node, handles synthétiques). Non couvert par les tests, comme dans Point Zéro : le raster (`analyzePdf`, `detectBlocks`, `legendEntries`, `convertBlockAuto`, `SymbolRegistry`, `rectify`) et `openPdf`, qui demandent un navigateur ; ils sont couverts par les parcours Playwright de la phase 05.
