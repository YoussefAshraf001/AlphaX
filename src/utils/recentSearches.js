const RECENT_SEARCHES_KEY = "alphax_recent_searches";
const DEFAULT_LIMIT = 8;

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
};

export const getRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    return normalizeList(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // noop
  }
};

export const addRecentSearch = (term, limit = DEFAULT_LIMIT) => {
  const query = String(term || "").trim();
  if (!query) return getRecentSearches();

  const current = getRecentSearches();
  const normalized = query.toLowerCase();
  const next = [
    query,
    ...current.filter((entry) => entry.toLowerCase() !== normalized),
  ].slice(0, limit);

  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // noop
  }

  return next;
};
