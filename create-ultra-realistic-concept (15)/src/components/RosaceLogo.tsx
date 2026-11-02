/**
 * Le logo ROSACE : une rosace en picto moderne, traits blancs sur fond sombre arrondi.
 * Huit pétales en traits fins, un anneau, un cœur — le même langage que la couronne du Disque.
 */
export function RosaceLogo({ size = 40 }: { size?: number }) {
  return (
    <span className="rosace-logo" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" stroke="#fff" strokeLinecap="round">
        <circle cx="24" cy="24" r="21.5" strokeWidth="1.4" opacity="0.5" />
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="24" cy="15.2" rx="3.1" ry="6.4" strokeWidth="1.7" transform={`rotate(${i * 45} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="6.8" strokeWidth="1.7" />
        <circle cx="24" cy="24" r="1.9" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}
