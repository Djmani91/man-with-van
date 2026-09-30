// Student discount promo config (single source of truth for the frontend).
export const STUDENT_CODE = "STUDENT10";
export const STUDENT_PCT = 0.10;
export const PROMO_STORAGE_KEY = "mwv_promo";

export const KNOWN_PROMOS = {
  [STUDENT_CODE]: { pct: STUDENT_PCT, label: "Student 10% off" },
};

export const getPromo = (code) => KNOWN_PROMOS[(code || "").trim().toUpperCase()] || null;

export const savePromo = (code) => {
  try { localStorage.setItem(PROMO_STORAGE_KEY, code.trim().toUpperCase()); } catch { /* noop */ }
};

export const loadPromo = () => {
  try { return localStorage.getItem(PROMO_STORAGE_KEY) || ""; } catch { return ""; }
};
