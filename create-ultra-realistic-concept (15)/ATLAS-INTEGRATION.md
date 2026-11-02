# ROSACE — l'application

## L'écran

ROSACE est une **application à écran fixe** : le document ne défile jamais. On manipule la rosace, on ne parcourt pas une page.

| Zone | Contenu |
|---|---|
| Barre du haut | Logo rosace (picto en traits blancs) + ROSACE® · annuler, rétablir, enregistrer, partager |
| Scène | Le tambour et sa couronne de 161 fils DMC, toujours visibles |
| Ligne de stats | Croix · fils · points · taille · temps estimé |
| Dock | Forme · Couleurs · Réglages · Grille · Collection · Export |
| Panneau | Les réglages de la catégorie choisie ; la scène se réduit, le tambour reste entier |

- **Mobile** : dock en bas (zone de sécurité respectée), panneau coulissant (~40 % de l'écran), fermeture par glissement de l'en-tête ou par le bouton.
- **Ordinateur (≥ 1024 px)** : mêmes composants — dock en rail vertical numéroté, panneau latéral droit.
- **Zoom** : pincement à deux doigts, molette + Ctrl, boutons +/− et recentrage, touches + − 0, double-clic pour recentrer.
- **Raccourcis** : Ctrl Z / Ctrl Maj Z / Ctrl Y, touches 1 à 6 pour les catégories, Échap pour fermer.
- **Apparence** : Auto / Jour / Nuit dans Réglages, clé `atlas-theme`, suit le système en Auto.

## Les catégories

| Catégorie | Contenu |
|---|---|
| Forme | Pétales, Tracé, Densité, Échelle, Tourbillon, Ondulation (curseurs 1–5) |
| Couleurs | Cinq harmonies (OKLCH + CIEDE2000), les fils avec leurs croix, nuancier complet, alertes de contraste |
| Réglages | Signature (graine), toile, aïda, apparence, réinitialisation |
| Grille | La grille technique sur place (zoom, coordonnées au survol) |
| Collection | Vos rosaces enregistrées (fenêtre) |
| Export | PNG, SVG, CSV, PDF et lien de partage |

## Architecture

| Couche | Fichiers |
|---|---|
| Moteur géométrique | `src/lib/rosace.ts` |
| Harmonies couleur | `src/lib/harmony.ts` |
| Rendu textile | `src/lib/paint.ts`, `src/lib/color.ts` |
| Exports | `src/lib/exporters.ts` |
| État unique | `src/state/rosace-store.tsx` |
| Interface | `src/components/*` (TopBar, Disque, ZoomStage, Panels, GridPanel, Loupe, Dialogs) |
| Styles | `src/styles/tokens.css`, `atlas.css`, `instrument.css`, `dialogues.css`, `fonts.css` |

Aucun calcul n'a été modifié : moteur, harmonies, fils DMC, nombre de croix et estimations sont ceux d'avant ;
seules les commandes ont été repositionnées.

## Monter ROSACE ailleurs

```tsx
import RosaceModule from "./RosaceModule";        // fournit l'état
// ou
import { RosaceContent } from "./RosaceModule";  // si l'état est déjà fourni
```

Le module n'attend ni dock ni pied de page. Hauteur requise : `100dvh` (l'application verrouille le défilement du document).

## Stockage local

`aime-rosace-current-v1` (recette en cours), `aime-rosace-favorites-v1` (historique des favoris), `atlas-theme` (apparence).
Aucun compte, aucun envoi vers un serveur.

## Limites

- Recette automatisée sur Chromium (390×844, 360×740, 768×1024, 1440×900) ; pas de test sur Safari ni Firefox, ni sur appareil physique.
- Le pincement est vérifié par événements pointeur synthétiques ; les boutons et le clavier le couvrent en alternative accessible.
- Les couleurs écran restent indicatives ; chaque fil est identifié par sa référence DMC, son nom et son symbole.
- Métrages, échevettes et temps sont des estimations calculées, signalées comme telles.
