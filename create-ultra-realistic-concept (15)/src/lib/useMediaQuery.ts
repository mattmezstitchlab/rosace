import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof matchMedia === "function" ? matchMedia(query).matches : false));
  useEffect(() => {
    const media = matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener("change", onChange);
    onChange();
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
