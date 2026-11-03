/**
 * Séances de broderie : le rythme réel de la brodeuse, déduit des croix cochées dans le temps.
 *
 * Une séance commence à la première croix et s'étend tant que les croix se suivent à moins de
 * `GAP_MS` d'écart. Les séances vivent dans la progression (à côté du journal), jamais dans le
 * patron. Elles permettent de remplacer l'estimation générique par « à votre rythme ».
 */
export const SESSION_GAP_MS = 20 * 60 * 1000;
export const MAX_SESSIONS = 400;

export interface StitchSession {
  /** ISO 8601 */
  start: string;
  end: string;
  /** Croix ajoutées pendant la séance (les retraits ne comptent pas). */
  stitches: number;
}

export function sanitizeSessions(raw: unknown): StitchSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is StitchSession =>
      Boolean(entry) && typeof (entry as StitchSession).start === "string" && typeof (entry as StitchSession).end === "string"
      && Number.isFinite(Date.parse((entry as StitchSession).start)) && Number.isFinite(Date.parse((entry as StitchSession).end))
      && Number.isInteger((entry as StitchSession).stitches) && (entry as StitchSession).stitches >= 0)
    .map((entry) => ({ start: entry.start, end: entry.end, stitches: entry.stitches }))
    .slice(-MAX_SESSIONS);
}

/** Enregistre `added` croix cochées à l'instant `at` : prolonge la séance en cours ou en ouvre une nouvelle. */
export function recordStitches(sessions: StitchSession[], added: number, at: Date = new Date()): StitchSession[] {
  if (added <= 0) return sessions;
  const stamp = at.toISOString();
  const last = sessions[sessions.length - 1];
  if (last && at.getTime() - Date.parse(last.end) <= SESSION_GAP_MS && at.getTime() >= Date.parse(last.end)) {
    return [...sessions.slice(0, -1), { ...last, end: stamp, stitches: last.stitches + added }];
  }
  return [...sessions, { start: stamp, end: stamp, stitches: added }].slice(-MAX_SESSIONS);
}

export interface Rhythm {
  /** Croix par heure, à partir des séances d'au moins 5 minutes. */
  stitchesPerHour: number;
  /** Minutes effectivement passées à broder. */
  minutes: number;
  sessions: number;
  /** Vrai dès qu'il y a assez de matière pour un rythme personnel (≥ 30 croix sur ≥ 10 minutes). */
  reliable: boolean;
}

export function computeRhythm(sessions: StitchSession[]): Rhythm {
  let ms = 0;
  let stitches = 0;
  for (const session of sessions) {
    const duration = Date.parse(session.end) - Date.parse(session.start);
    // Une séance d'une seule croix n'a pas de durée : on lui accorde une minute forfaitaire.
    const effective = Math.max(duration, 60_000);
    ms += effective;
    stitches += session.stitches;
  }
  const minutes = Math.round(ms / 60_000);
  const hours = ms / 3_600_000;
  const stitchesPerHour = hours > 0 ? Math.round(stitches / hours) : 0;
  return { stitchesPerHour, minutes, sessions: sessions.length, reliable: stitches >= 30 && minutes >= 10 };
}

export interface Forecast {
  remainingMinutes: number;
  /** Fourchette honnête : ±30 % autour du rythme observé. */
  low: number;
  high: number;
  /** Date probable de fin, si la brodeuse garde la cadence moyenne de ses séances (minutes brodées par jour calendaire). */
  finishDate: Date | null;
}

export function forecast(rhythm: Rhythm, remainingStitches: number, sessions: StitchSession[], now: Date = new Date()): Forecast | null {
  if (!rhythm.reliable || rhythm.stitchesPerHour <= 0) return null;
  const hours = remainingStitches / rhythm.stitchesPerHour;
  const remainingMinutes = Math.round(hours * 60);
  const first = sessions.length ? Date.parse(sessions[0].start) : now.getTime();
  const calendarDays = Math.max(1, (now.getTime() - first) / 86_400_000);
  const minutesPerDay = rhythm.minutes / calendarDays;
  const finishDate = minutesPerDay > 0 ? new Date(now.getTime() + (remainingMinutes / minutesPerDay) * 86_400_000) : null;
  return { remainingMinutes, low: Math.round(remainingMinutes * 0.7), high: Math.round(remainingMinutes * 1.3), finishDate };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`;
}
