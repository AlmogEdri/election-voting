// Transcribed by hand from docs/PRD.md §4 and §5, independent of lib/defaults.ts.
export const PRD_PARTIES = [
  { name: "הליכוד", letters: "מחל", leader: "בנימין נתניהו", bloc: "ימין", seats: 23 },
  { name: "ישר! עם איזנקוט", letters: "דרך", leader: "גדי איזנקוט", bloc: "מרכז", seats: 21 },
  { name: "ביחד (בנט–לפיד)", letters: "רק", leader: "נפתלי בנט", bloc: "מרכז-ימין", seats: 14 },
  { name: "הדמוקרטים", letters: "אמת", leader: "יאיר גולן", bloc: "שמאל", seats: 10 },
  { name: 'הרשימה המשותפת (חד"ש–בל"ד–תע"ל)', letters: "ודם", leader: "יוסף ג'בארין", bloc: "ערבי", seats: 9 },
  { name: "ישראל ביתנו", letters: "ל", leader: "אביגדור ליברמן", bloc: "ימין חילוני", seats: 8 },
  { name: 'ש"ס', letters: "שס", leader: "אריה דרעי", bloc: "חרדי", seats: 8 },
  { name: "עוצמה יהודית", letters: "ב", leader: "איתמר בן גביר", bloc: "ימין קיצוני", seats: 7 },
  { name: "הציונות הדתית וזהות", letters: "ט", leader: "בצלאל סמוטריץ' / משה פייגלין", bloc: "ימין דתי", seats: 7 },
  { name: "יהדות התורה", letters: "ג", leader: "יעקב אשר", bloc: "חרדי", seats: 7 },
  { name: 'רע"ם', letters: "עם", leader: "מנסור עבאס", bloc: "ערבי", seats: 6 },
  { name: "המילואימניקים והכלכלית", letters: "די", leader: "יועז הנדל / ירון זליכה", bloc: "מרכז-ימין", seats: 0 },
  { name: "עמך ישראל", letters: "ך", leader: "עופר וינטר", bloc: "ימין", seats: 0 },
  { name: "כחול לבן", letters: "כן", leader: "בני גנץ", bloc: "מרכז", seats: 0 },
];

export const PRD_PM_CANDIDATES = [
  "בנימין נתניהו",
  "גדי איזנקוט",
  "נפתלי בנט",
  "יאיר לפיד",
  "יאיר גולן",
  "אביגדור ליברמן",
  "איתמר בן גביר",
  "בצלאל סמוטריץ'",
  "בחירות נוספות",
];

/** The seed allocation keyed by stable party id. */
export const SEED_SEATS = {
  likud: 23,
  yashar: 21,
  beyachad: 14,
  democrats: 10,
  "joint-list": 9,
  "yisrael-beiteinu": 8,
  shas: 8,
  otzma: 7,
  "rz-zehut": 7,
  utj: 7,
  raam: 6,
  miluimnikim: 0,
  amcha: 0,
  "blue-white": 0,
};
