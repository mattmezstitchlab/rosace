import referenceCatalog from "./dmc-reference.json";

export type ThreadFamily = "roses" | "violets" | "verts" | "jaunes" | "bleus" | "terres" | "neutres";

/**
 * Catalogue DMC Mouliné.
 * - Les 161 références historiques ROSACE gardent exactement leurs codes, noms français
 *   et valeurs d'écran : aucune appellation ni teinte existante n'est remplacée.
 * - Les références manquantes sont ajoutées depuis la source ouverte MakeBead
 *   (craft-color-codes, CC BY 4.0), avec leur nom anglais et leur valeur d'écran.
 * - Les deux valeurs sont des approximations : DMC ne publie pas de table RGB officielle
 *   et une échevette réelle varie selon le bain et la lumière. Voir DMC-SOURCES.md.
 */
export const DMC_CATALOG_META = {
  historicalCount: 161,
  referenceCount: referenceCatalog.count,
  source: "MakeBead craft-color-codes, data/json/dmc-floss.json",
  license: "CC BY 4.0",
  note: "Hex écran approximatifs, non mesures sur fil.",
} as const;

export interface DmcThread {
  code: string;
  name: string;
  hex: string;
  family: ThreadFamily;
}

export const FAMILY_LABELS: Record<ThreadFamily, string> = {
  roses: "Roses & rouges",
  violets: "Violets & mauves",
  verts: "Verts",
  jaunes: "Jaunes & ors",
  bleus: "Bleus",
  terres: "Terres & cuivres",
  neutres: "Neutres & lin",
};

// Valeurs écran indicatives : les références et noms suivent le nuancier DMC Mouliné.
export const DMC_THREADS: DmcThread[] = [
  { code: "B5200", name: "Blanc neige", hex: "#FFFFFF", family: "neutres" },
  { code: "BLANC", name: "Blanc", hex: "#FCFBF8", family: "neutres" },
  { code: "ECRU", name: "Écru", hex: "#F0E6D2", family: "neutres" },
  { code: "3865", name: "Blanc d'hiver", hex: "#F9F7F1", family: "neutres" },
  { code: "3866", name: "Mastic très clair", hex: "#F2EBDD", family: "neutres" },
  { code: "712", name: "Crème", hex: "#FFFBEF", family: "neutres" },
  { code: "738", name: "Fauve très clair", hex: "#ECCC9E", family: "neutres" },
  { code: "739", name: "Fauve ultra clair", hex: "#F8E4C8", family: "neutres" },
  { code: "3033", name: "Moka très clair", hex: "#E3D3BC", family: "neutres" },
  { code: "3782", name: "Brun moka clair", hex: "#D2BCA6", family: "neutres" },
  { code: "3781", name: "Brun moka foncé", hex: "#6B574E", family: "neutres" },
  { code: "3024", name: "Gris brun très clair", hex: "#EBEAE7", family: "neutres" },
  { code: "3023", name: "Gris brun clair", hex: "#B1A697", family: "neutres" },
  { code: "3022", name: "Gris brun moyen", hex: "#8E907F", family: "neutres" },
  { code: "3021", name: "Gris brun très foncé", hex: "#4F4B41", family: "neutres" },
  { code: "3072", name: "Gris castor très clair", hex: "#E6E8E6", family: "neutres" },
  { code: "3799", name: "Gris étain très foncé", hex: "#424242", family: "neutres" },
  { code: "310", name: "Noir", hex: "#000000", family: "neutres" },

  { code: "225", name: "Rose coquillage ultra clair", hex: "#FFEBE5", family: "roses" },
  { code: "224", name: "Rose coquillage très clair", hex: "#EBB7B3", family: "roses" },
  { code: "223", name: "Rose coquillage clair", hex: "#CC8E96", family: "roses" },
  { code: "152", name: "Rose coquillage moyen", hex: "#E2A09F", family: "roses" },
  { code: "3713", name: "Saumon très clair", hex: "#FFE2DF", family: "roses" },
  { code: "761", name: "Saumon clair", hex: "#FFC9C2", family: "roses" },
  { code: "3712", name: "Saumon moyen", hex: "#F18780", family: "roses" },
  { code: "760", name: "Saumon", hex: "#F5ADAD", family: "roses" },
  { code: "3708", name: "Melon clair", hex: "#FFCBD2", family: "roses" },
  { code: "3706", name: "Melon moyen", hex: "#FFADBA", family: "roses" },
  { code: "3705", name: "Melon foncé", hex: "#FF7992", family: "roses" },
  { code: "3801", name: "Melon très foncé", hex: "#E74967", family: "roses" },
  { code: "3806", name: "Cyclamen clair", hex: "#FF8CAE", family: "roses" },
  { code: "3805", name: "Cyclamen", hex: "#F34778", family: "roses" },
  { code: "3804", name: "Cyclamen foncé", hex: "#E02876", family: "roses" },
  { code: "3833", name: "Framboise clair", hex: "#EA869D", family: "roses" },
  { code: "3832", name: "Framboise moyen", hex: "#DB556F", family: "roses" },
  { code: "3831", name: "Framboise foncé", hex: "#B32B48", family: "roses" },
  { code: "962", name: "Vieux rose moyen", hex: "#D47575", family: "roses" },
  { code: "961", name: "Vieux rose foncé", hex: "#CF7373", family: "roses" },
  { code: "3716", name: "Vieux rose très clair", hex: "#FFBDBD", family: "roses" },
  { code: "899", name: "Rose moyen", hex: "#F27688", family: "roses" },
  { code: "335", name: "Rose", hex: "#EE546E", family: "roses" },
  { code: "326", name: "Rose très foncé", hex: "#B33B4B", family: "roses" },
  { code: "816", name: "Grenat", hex: "#970B23", family: "roses" },
  { code: "815", name: "Grenat moyen", hex: "#87071F", family: "roses" },
  { code: "814", name: "Grenat foncé", hex: "#7B001B", family: "roses" },
  { code: "902", name: "Grenat très foncé", hex: "#6B1835", family: "roses" },

  { code: "3609", name: "Prune ultra clair", hex: "#F4AED7", family: "violets" },
  { code: "3608", name: "Prune très clair", hex: "#EA9CC4", family: "violets" },
  { code: "3607", name: "Prune clair", hex: "#C54989", family: "violets" },
  { code: "718", name: "Prune", hex: "#9C2462", family: "violets" },
  { code: "917", name: "Prune moyen", hex: "#9B1359", family: "violets" },
  { code: "915", name: "Prune foncé", hex: "#820043", family: "violets" },
  { code: "3689", name: "Mauve clair", hex: "#FBBFC2", family: "violets" },
  { code: "3688", name: "Mauve moyen", hex: "#E7A9AC", family: "violets" },
  { code: "3687", name: "Mauve", hex: "#C96B70", family: "violets" },
  { code: "3685", name: "Mauve très foncé", hex: "#881531", family: "violets" },
  { code: "3803", name: "Mauve foncé", hex: "#AB3357", family: "violets" },
  { code: "3802", name: "Mauve antique très foncé", hex: "#714149", family: "violets" },
  { code: "211", name: "Lavande clair", hex: "#E3CBE3", family: "violets" },
  { code: "210", name: "Lavande moyen", hex: "#C39FC3", family: "violets" },
  { code: "209", name: "Lavande foncé", hex: "#A37BA7", family: "violets" },
  { code: "208", name: "Lavande très foncé", hex: "#835B8B", family: "violets" },
  { code: "554", name: "Violet clair", hex: "#DBB3D9", family: "violets" },
  { code: "553", name: "Violet", hex: "#A3639A", family: "violets" },
  { code: "552", name: "Violet moyen", hex: "#803A6B", family: "violets" },
  { code: "550", name: "Violet très foncé", hex: "#5C184E", family: "violets" },
  { code: "341", name: "Bleu violet clair", hex: "#B7C0E2", family: "violets" },
  { code: "340", name: "Bleu violet moyen", hex: "#ADA7D0", family: "violets" },
  { code: "333", name: "Bleu violet très foncé", hex: "#5C5478", family: "violets" },

  { code: "3348", name: "Vert jaune clair", hex: "#CCD98C", family: "verts" },
  { code: "3347", name: "Vert jaune moyen", hex: "#718A3D", family: "verts" },
  { code: "3346", name: "Vert chasseur", hex: "#406A3A", family: "verts" },
  { code: "3345", name: "Vert chasseur foncé", hex: "#1B5915", family: "verts" },
  { code: "907", name: "Vert perroquet clair", hex: "#C7E666", family: "verts" },
  { code: "906", name: "Vert perroquet moyen", hex: "#7FB335", family: "verts" },
  { code: "905", name: "Vert perroquet foncé", hex: "#627A0A", family: "verts" },
  { code: "904", name: "Vert perroquet très foncé", hex: "#557822", family: "verts" },
  { code: "472", name: "Avocat ultra clair", hex: "#D8E498", family: "verts" },
  { code: "471", name: "Avocat très clair", hex: "#AEBF79", family: "verts" },
  { code: "470", name: "Avocat clair", hex: "#94AB4F", family: "verts" },
  { code: "469", name: "Avocat", hex: "#72843C", family: "verts" },
  { code: "937", name: "Avocat moyen", hex: "#627133", family: "verts" },
  { code: "936", name: "Avocat très foncé", hex: "#4C5826", family: "verts" },
  { code: "734", name: "Olive clair", hex: "#C7C077", family: "verts" },
  { code: "733", name: "Olive moyen", hex: "#BCB34C", family: "verts" },
  { code: "732", name: "Olive", hex: "#948C36", family: "verts" },
  { code: "731", name: "Olive foncé", hex: "#938B37", family: "verts" },
  { code: "730", name: "Olive très foncé", hex: "#845B25", family: "verts" },
  { code: "581", name: "Vert mousse", hex: "#97A258", family: "verts" },
  { code: "580", name: "Vert mousse foncé", hex: "#888D33", family: "verts" },
  { code: "3819", name: "Vert mousse clair", hex: "#E0E868", family: "verts" },
  { code: "3013", name: "Kaki clair", hex: "#B9B982", family: "verts" },
  { code: "3012", name: "Kaki moyen", hex: "#A6A75D", family: "verts" },
  { code: "3011", name: "Kaki foncé", hex: "#898A58", family: "verts" },

  { code: "3823", name: "Jaune paille ultra pâle", hex: "#FFFDE3", family: "jaunes" },
  { code: "3822", name: "Jaune paille clair", hex: "#F6DC98", family: "jaunes" },
  { code: "3821", name: "Jaune paille", hex: "#F3CE75", family: "jaunes" },
  { code: "3820", name: "Jaune paille foncé", hex: "#DFB65F", family: "jaunes" },
  { code: "745", name: "Jaune pâle clair", hex: "#FFE9AD", family: "jaunes" },
  { code: "744", name: "Jaune pâle", hex: "#FFE793", family: "jaunes" },
  { code: "727", name: "Topaze très clair", hex: "#FFF1AF", family: "jaunes" },
  { code: "726", name: "Topaze clair", hex: "#FDD755", family: "jaunes" },
  { code: "725", name: "Topaze moyen", hex: "#FFC840", family: "jaunes" },
  { code: "728", name: "Topaze", hex: "#E4B40F", family: "jaunes" },
  { code: "783", name: "Topaze moyen", hex: "#CE9124", family: "jaunes" },
  { code: "782", name: "Topaze foncé", hex: "#AE7720", family: "jaunes" },
  { code: "781", name: "Topaze très foncé", hex: "#A26200", family: "jaunes" },
  { code: "780", name: "Topaze ultra foncé", hex: "#94631A", family: "jaunes" },
  { code: "677", name: "Vieil or très clair", hex: "#F5ECCB", family: "jaunes" },
  { code: "676", name: "Vieil or clair", hex: "#E5CE97", family: "jaunes" },
  { code: "729", name: "Vieil or moyen", hex: "#D0A53E", family: "jaunes" },
  { code: "680", name: "Vieil or foncé", hex: "#BC8D0E", family: "jaunes" },
  { code: "422", name: "Noisette clair", hex: "#C69F7B", family: "jaunes" },

  { code: "827", name: "Bleu très clair", hex: "#BDDDED", family: "bleus" },
  { code: "826", name: "Bleu moyen", hex: "#6B9EBF", family: "bleus" },
  { code: "825", name: "Bleu foncé", hex: "#4781A1", family: "bleus" },
  { code: "824", name: "Bleu très foncé", hex: "#396987", family: "bleus" },
  { code: "823", name: "Bleu marine foncé", hex: "#213063", family: "bleus" },
  { code: "800", name: "Bleu delft pâle", hex: "#C0CCDE", family: "bleus" },
  { code: "799", name: "Bleu delft moyen", hex: "#748EB6", family: "bleus" },
  { code: "798", name: "Bleu delft foncé", hex: "#466A8E", family: "bleus" },
  { code: "797", name: "Bleu royal", hex: "#13477D", family: "bleus" },
  { code: "3756", name: "Bleu layette ultra clair", hex: "#EEFCFC", family: "bleus" },
  { code: "775", name: "Bleu layette très clair", hex: "#D9EBF1", family: "bleus" },
  { code: "3755", name: "Bleu layette", hex: "#93B4CE", family: "bleus" },
  { code: "3325", name: "Bleu layette clair", hex: "#B8D2E6", family: "bleus" },
  { code: "3753", name: "Bleu antique ultra clair", hex: "#DBE2E9", family: "bleus" },
  { code: "3752", name: "Bleu antique très clair", hex: "#C7D1DB", family: "bleus" },
  { code: "932", name: "Bleu antique clair", hex: "#A2B5C6", family: "bleus" },
  { code: "931", name: "Bleu antique moyen", hex: "#6A859E", family: "bleus" },
  { code: "930", name: "Bleu antique foncé", hex: "#455C71", family: "bleus" },
  { code: "519", name: "Bleu ciel", hex: "#7EB1C8", family: "bleus" },
  { code: "518", name: "Wedgwood clair", hex: "#4F93A7", family: "bleus" },
  { code: "517", name: "Wedgwood foncé", hex: "#3B768F", family: "bleus" },
  { code: "3761", name: "Bleu ciel clair", hex: "#ACD8E2", family: "bleus" },
  { code: "3760", name: "Wedgwood moyen", hex: "#3E85A2", family: "bleus" },
  { code: "807", name: "Bleu paon", hex: "#64ABBA", family: "bleus" },
  { code: "806", name: "Bleu paon foncé", hex: "#3D8CA5", family: "bleus" },
  { code: "3765", name: "Bleu paon très foncé", hex: "#347F8C", family: "bleus" },

  { code: "353", name: "Corail très clair", hex: "#FEB4A4", family: "terres" },
  { code: "352", name: "Corail clair", hex: "#FD9C85", family: "terres" },
  { code: "351", name: "Corail", hex: "#E96A67", family: "terres" },
  { code: "350", name: "Corail moyen", hex: "#E04848", family: "terres" },
  { code: "349", name: "Corail foncé", hex: "#D21035", family: "terres" },
  { code: "3779", name: "Terre cuite ultra clair", hex: "#F8CAB8", family: "terres" },
  { code: "3778", name: "Terre cuite clair", hex: "#D98978", family: "terres" },
  { code: "356", name: "Terre cuite moyen", hex: "#C56A5B", family: "terres" },
  { code: "355", name: "Terre cuite foncé", hex: "#984436", family: "terres" },
  { code: "3777", name: "Terre cuite très foncé", hex: "#863022", family: "terres" },
  { code: "922", name: "Cuivre clair", hex: "#E27346", family: "terres" },
  { code: "921", name: "Cuivre", hex: "#C6623A", family: "terres" },
  { code: "920", name: "Cuivre moyen", hex: "#AC5414", family: "terres" },
  { code: "919", name: "Cuivre rouge", hex: "#A64510", family: "terres" },
  { code: "918", name: "Cuivre rouge foncé", hex: "#82340A", family: "terres" },
  { code: "900", name: "Orange brûlé foncé", hex: "#D15807", family: "terres" },
  { code: "722", name: "Orange épice clair", hex: "#F7976F", family: "terres" },
  { code: "721", name: "Orange épice moyen", hex: "#F27842", family: "terres" },
  { code: "720", name: "Orange épice foncé", hex: "#E55B1F", family: "terres" },
  { code: "3857", name: "Palissandre foncé", hex: "#68251A", family: "terres" },
  { code: "3858", name: "Palissandre moyen", hex: "#964A3F", family: "terres" },
  { code: "3859", name: "Palissandre clair", hex: "#BA8B7C", family: "terres" },
];

function familyFromHex(hex: string): ThreadFamily {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 510;
  const delta = (max - min) / 255;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (sat < 0.14) return "neutres";
  let hue: number;
  const d = max - min;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue >= 330 || hue < 15) return "roses";
  if (hue < 45) return "terres";
  if (hue < 70) return "jaunes";
  if (hue < 170) return "verts";
  if (hue < 260) return "bleus";
  return "violets";
}

// Les codes sont comparés sans casse pour ne jamais dupliquer BLANC/Blanc ou ECRU/Ecru.
const historical = new Set(DMC_THREADS.map((thread) => thread.code.toUpperCase()));
const additions = (referenceCatalog.colors as Array<{ code: string; name: string; hex: string }>)
  .filter((entry) => !historical.has(String(entry.code).toUpperCase()))
  .sort((a, b) => String(a.code).localeCompare(String(b.code), "fr", { numeric: true }))
  .map<DmcThread>((entry) => ({
    code: String(entry.code).toUpperCase(),
    name: entry.name,
    hex: entry.hex.toUpperCase(),
    family: familyFromHex(entry.hex),
  }));
export const DMC_ADDED_THREADS = additions;
export const DMC_ALL_THREADS: DmcThread[] = [...DMC_THREADS, ...additions];
export const THREAD_BY_CODE = new Map(DMC_ALL_THREADS.map((thread) => [thread.code, thread]));

export const DEFAULT_PALETTE = ["902", "3607", "3608", "907", "677"];

export function getThread(code: string): DmcThread {
  return THREAD_BY_CODE.get(code) ?? DMC_ALL_THREADS[0];
}
