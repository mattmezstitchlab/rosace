/**
 * Le logo ROSACE.
 *
 * Une rosace de huit pétales ouverts, enfermée dans son cercle, avec une croix de
 * point de croix au cœur : le motif circulaire, la couronne, et le geste de broderie
 * dans un seul signe. Le dessin est monochrome (currentColor) pour tenir aussi bien
 * sur la tuile d'encre de l'atelier que sur le crème de la présentation.
 *
 * Pétale : ogive tracée depuis le cœur (r = 7) jusqu'à la couronne (r = 20,7).
 */
const PETAL = "M24 17C20.05 14.26 21.55 3.99 24 3.3C26.45 3.99 27.95 14.26 24 17Z";
const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

interface RosaceLogoProps {
  /** Côté de la tuile, en pixels. */
  size?: number;
  /** « tuile » : carré d'encre arrondi (interface). « nu » : le trait seul (fond libre). */
  variant?: "tuile" | "nu";
  /** Renseigné seulement si le logo est le seul porteur du nom ; sinon il reste décoratif. */
  label?: string;
  className?: string;
}

export function RosaceLogo({ size = 40, variant = "tuile", label, className }: RosaceLogoProps) {
  return (
    <span
      className={`rosace-logo ${variant === "nu" ? "rosace-logo--nu" : ""} ${className ?? ""}`.trim()}
      style={{ width: size, height: size }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const })}
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="currentColor" focusable="false">
        <circle cx="24" cy="24" r="21.9" strokeWidth="1.05" opacity={variant === "nu" ? 0.28 : 0.42} />
        {PETAL_ANGLES.map((angle) => (
          <path
            key={angle}
            d={PETAL}
            strokeWidth="1.85"
            strokeLinejoin="round"
            strokeLinecap="round"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="7" strokeWidth="1.5" />
        <path d="M21.55 21.55 26.45 26.45M21.55 26.45 26.45 21.55" strokeWidth="1.35" strokeLinecap="round" />
      </svg>
    </span>
  );
}
