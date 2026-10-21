// Default configuration from docs/PRD.md §4–§5. Seeded once; the admin can edit it later.

export const TOTAL_SEATS = 120;
export const DEFAULT_MIN_SEATS = 4;
/** 27.10.2026 22:00 Asia/Jerusalem (IST, UTC+2 after DST ends on 25.10). */
export const DEFAULT_LOCK_AT = "2026-10-27T20:00:00.000Z";
export const NEW_ELECTIONS_ID = "new-elections";
/** Lists that are not shown individually; informational only, always 0 seats. */
export const OTHER_LISTS_COUNT = 38 - 14;

export type PartyDefault = {
  id: string;
  name: string;
  letters: string;
  leader: string;
  color: string;
  bloc: string;
  sort: number;
  withdrawn: boolean;
  defaultSeats: number;
};

export type PmCandidateDefault = {
  id: string;
  name: string;
  partyId: string | null;
  sort: number;
};

export const DEFAULT_PARTIES: PartyDefault[] = [
  { id: "likud", name: "הליכוד", letters: "מחל", leader: "בנימין נתניהו", color: "#1e40af", bloc: "ימין", sort: 1, withdrawn: false, defaultSeats: 23 },
  { id: "yashar", name: "ישר! עם איזנקוט", letters: "דרך", leader: "גדי איזנקוט", color: "#38bdf8", bloc: "מרכז", sort: 2, withdrawn: false, defaultSeats: 21 },
  { id: "beyachad", name: "ביחד (בנט–לפיד)", letters: "רק", leader: "נפתלי בנט", color: "#7e22ce", bloc: "מרכז-ימין", sort: 3, withdrawn: false, defaultSeats: 14 },
  { id: "democrats", name: "הדמוקרטים", letters: "אמת", leader: "יאיר גולן", color: "#dc2626", bloc: "שמאל", sort: 4, withdrawn: false, defaultSeats: 10 },
  { id: "joint-list", name: "הרשימה המשותפת (חד\"ש–בל\"ד–תע\"ל)", letters: "ודם", leader: "יוסף ג'בארין", color: "#166534", bloc: "ערבי", sort: 5, withdrawn: false, defaultSeats: 9 },
  { id: "yisrael-beiteinu", name: "ישראל ביתנו", letters: "ל", leader: "אביגדור ליברמן", color: "#172554", bloc: "ימין חילוני", sort: 6, withdrawn: false, defaultSeats: 8 },
  { id: "shas", name: "ש\"ס", letters: "שס", leader: "אריה דרעי", color: "#111827", bloc: "חרדי", sort: 7, withdrawn: false, defaultSeats: 8 },
  { id: "otzma", name: "עוצמה יהודית", letters: "ב", leader: "איתמר בן גביר", color: "#facc15", bloc: "ימין קיצוני", sort: 8, withdrawn: false, defaultSeats: 7 },
  { id: "rz-zehut", name: "הציונות הדתית וזהות", letters: "ט", leader: "בצלאל סמוטריץ' / משה פייגלין", color: "#f97316", bloc: "ימין דתי", sort: 9, withdrawn: false, defaultSeats: 7 },
  { id: "utj", name: "יהדות התורה", letters: "ג", leader: "יעקב אשר", color: "#4b5563", bloc: "חרדי", sort: 10, withdrawn: false, defaultSeats: 7 },
  { id: "raam", name: "רע\"ם", letters: "עם", leader: "מנסור עבאס", color: "#16a34a", bloc: "ערבי", sort: 11, withdrawn: false, defaultSeats: 6 },
  { id: "miluimnikim", name: "המילואימניקים והכלכלית", letters: "די", leader: "יועז הנדל / ירון זליכה", color: "#a78bfa", bloc: "מרכז-ימין", sort: 12, withdrawn: false, defaultSeats: 0 },
  { id: "amcha", name: "עמך ישראל", letters: "ך", leader: "עופר וינטר", color: "#3b82f6", bloc: "ימין", sort: 13, withdrawn: false, defaultSeats: 0 },
  { id: "blue-white", name: "כחול לבן", letters: "כן", leader: "בני גנץ", color: "#0284c7", bloc: "מרכז", sort: 14, withdrawn: true, defaultSeats: 0 },
];

export const DEFAULT_PM_CANDIDATES: PmCandidateDefault[] = [
  { id: "netanyahu", name: "בנימין נתניהו", partyId: "likud", sort: 1 },
  { id: "eisenkot", name: "גדי איזנקוט", partyId: "yashar", sort: 2 },
  { id: "bennett", name: "נפתלי בנט", partyId: "beyachad", sort: 3 },
  { id: "lapid", name: "יאיר לפיד", partyId: "beyachad", sort: 4 },
  { id: "golan", name: "יאיר גולן", partyId: "democrats", sort: 5 },
  { id: "liberman", name: "אביגדור ליברמן", partyId: "yisrael-beiteinu", sort: 6 },
  { id: "ben-gvir", name: "איתמר בן גביר", partyId: "otzma", sort: 7 },
  { id: "smotrich", name: "בצלאל סמוטריץ'", partyId: "rz-zehut", sort: 8 },
  { id: NEW_ELECTIONS_ID, name: "בחירות נוספות", partyId: null, sort: 1000 },
];

export const SETTING_KEYS = {
  lockMode: "lock_mode",
  lockedAt: "locked_at",
  minSeats: "min_seats",
  realResults: "real_results",
} as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  [SETTING_KEYS.lockMode]: "scheduled",
  [SETTING_KEYS.lockedAt]: DEFAULT_LOCK_AT,
  [SETTING_KEYS.minSeats]: DEFAULT_MIN_SEATS,
  [SETTING_KEYS.realResults]: null,
};
