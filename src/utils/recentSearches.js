const RECENT_SEARCHES_KEY = "alphax_recent_searches";
const DEFAULT_LIMIT = 8;
const DEFAULT_SCOPE = "global";

const keyForScope = (scope = DEFAULT_SCOPE) =>
  `${RECENT_SEARCHES_KEY}:${String(scope || DEFAULT_SCOPE)}`;

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
};

export const getRecentSearches = (scope = DEFAULT_SCOPE) => {
  try {
    const raw = localStorage.getItem(keyForScope(scope));
    if (!raw) return [];
    return normalizeList(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const clearRecentSearches = (scope = DEFAULT_SCOPE) => {
  try {
    localStorage.removeItem(keyForScope(scope));
  } catch {
    // noop
  }
};

export const addRecentSearch = (
  term,
  limit = DEFAULT_LIMIT,
  scope = DEFAULT_SCOPE,
) => {
  const query = String(term || "").trim();
  if (!query) return getRecentSearches(scope);

  const current = getRecentSearches(scope);
  const normalized = query.toLowerCase();
  const next = [
    query,
    ...current.filter((entry) => entry.toLowerCase() !== normalized),
  ].slice(0, limit);

  try {
    localStorage.setItem(keyForScope(scope), JSON.stringify(next));
  } catch {
    // noop
  }

  return next;
};
