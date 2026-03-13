import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ImSpinner2 } from "react-icons/im";
import { FaHeart, FaRegHeart, FaTrash } from "react-icons/fa";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";

import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";
import { addRecentSearch, getRecentSearches } from "../utils/recentSearches";
import { db } from "../firebase";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useSavedContent } from "../context/SavedContentContext";
import PersonalRating from "../components/actions/PersonalRating";
import {
  profileLikedActorItemPath,
  profileLikedActorsCollectionPath,
  profileRatingItemPath,
  profileRatingsCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const STATUS_BUTTONS = [
  { key: "Want to Watch", label: "Want" },
  { key: "Watching", label: "Watching" },
  { key: "Finished", label: "Finished" },
  { key: "Paused", label: "Paused" },
  { key: "Dropped", label: "Dropped" },
];

const SEARCH_FILTERS = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "Shows" },
  { key: "person", label: "People" },
];

const SORT_OPTIONS = [
  { key: "best-match", label: "Best Match" },
  { key: "name", label: "Name" },
  { key: "release-date", label: "Release Date" },
];

const formatKnownFor = (item) => {
  if (!Array.isArray(item?.known_for) || item.known_for.length === 0) return "";
  return item.known_for
    .map((entry) => entry?.title || entry?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
};
const RemoveConfirmModal = ({ open, item, onCancel, onConfirm }) => {
  if (!open || !item) return null;

  const isPerson = item.mediaType === "person";
  const title = item.title || item.name || "this entry";
  const typeLabel =
    item.mediaType === "movie"
      ? "movie"
      : item.mediaType === "tv"
        ? "show"
        : "person";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">
          Remove From Library?
        </h2>
        <p className="mt-2 text-sm text-white/65">
          This action will remove{" "}
          <span className="text-white font-bold">{title}</span>{" "}
          {isPerson
            ? "from your saved people data"
            : `from your saved ${typeLabel}s including rating and status`}
          ?
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white/10 px-4 py-2 text-sm text-white/85 transition hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-500"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

const Search = () => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const { savedItems } = useSavedContent();
  const activeProfileId = resolveProfileId(selectedProfile);
  const recentSearchScope = `${user?.email || "guest"}:${selectedProfile?.id || "main"}`;
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [ratingsMap, setRatingsMap] = useState({});
  const [likedActorsMap, setLikedActorsMap] = useState({});
  const [actorRatingsMap, setActorRatingsMap] = useState({});
  const [localStatusMap, setLocalStatusMap] = useState({});
  const [localFavouriteMap, setLocalFavouriteMap] = useState({});
  const [localRatingMap, setLocalRatingMap] = useState({});
  const [localNotInterestedMap, setLocalNotInterestedMap] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("best-match");
  const [sortDirection, setSortDirection] = useState("desc");
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches(recentSearchScope));
  }, [recentSearchScope]);

  useEffect(() => {
    if (!query) return;
    setRecentSearches(addRecentSearch(query, undefined, recentSearchScope));
  }, [query, recentSearchScope]);

  useEffect(() => {
    if (!user?.email) {
      setRatingsMap({});
      setLikedActorsMap({});
      setActorRatingsMap({});
      return;
    }

    const moviesRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showsRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "shows"),
    );
    const actorsRef = collection(
      db,
      ...profileLikedActorsCollectionPath(user.email, activeProfileId),
    );
    const actorRatingsRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "actors"),
    );

    let movieRatings = {};
    let showRatings = {};

    const sync = () => {
      setRatingsMap({ ...movieRatings, ...showRatings });
    };

    const unsubMovies = onSnapshot(moviesRef, (snap) => {
      movieRatings = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        movieRatings[`movie:${Number(data.id || entry.id)}`] = Number(
          data.value || 0,
        );
      });
      sync();
    });

    const unsubShows = onSnapshot(showsRef, (snap) => {
      showRatings = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        showRatings[`tv:${Number(data.id || entry.id)}`] = Number(
          data.value || 0,
        );
      });
      sync();
    });

    const unsubActors = onSnapshot(actorsRef, (snap) => {
      const next = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        next[String(data.id || entry.id)] = true;
      });
      setLikedActorsMap(next);
    });

    const unsubActorRatings = onSnapshot(actorRatingsRef, (snap) => {
      const next = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        next[String(data.id || entry.id)] = Number(data.value || 0);
      });
      setActorRatingsMap(next);
    });

    return () => {
      unsubMovies();
      unsubShows();
      unsubActors();
      unsubActorRatings();
    };
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    setLocalStatusMap({});
    setLocalFavouriteMap({});
    setLocalRatingMap({});
    setLocalNotInterestedMap({});
    setActiveFilter("all");
    setSortBy("best-match");
    setSortDirection("desc");
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const fetchResults = async () => {
      if (!query) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const requestDefs = [
          { mediaType: "movie", page: 1 },
          { mediaType: "movie", page: 2 },
          { mediaType: "tv", page: 1 },
          { mediaType: "tv", page: 2 },
          { mediaType: "person", page: 1 },
          { mediaType: "person", page: 2 },
        ];

        const responses = await Promise.all(
          requestDefs.map(({ mediaType, page }) =>
            axios.get(`https://api.themoviedb.org/3/search/${mediaType}`, {
              params: {
                api_key: process.env.REACT_APP_TMDB_API_KEY,
                query,
                page,
              },
            }),
          ),
        );

        if (cancelled) return;

        const merged = responses
          .flatMap((response, index) => {
            const mediaType = requestDefs[index].mediaType;
            return (response?.data?.results || []).map((item) => ({
              ...item,
              mediaType,
            }));
          })
          .filter((item) => Number(item?.id) > 0);

        const deduped = Array.from(
          new Map(
            merged.map((item) => [`${item.mediaType}-${item.id}`, item]),
          ).values(),
        ).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        setResults(deduped);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return results;
    return results.filter((item) => item.mediaType === activeFilter);
  }, [results, activeFilter]);

  const sortedResults = useMemo(() => {
    const items = [...filteredResults];
    const directionFactor = sortDirection === "asc" ? 1 : -1;

    if (sortBy === "name") {
      return items.sort((a, b) => {
        const aName = String(a.title || a.name || "")
          .trim()
          .toLowerCase();
        const bName = String(b.title || b.name || "")
          .trim()
          .toLowerCase();
        return aName.localeCompare(bName) * directionFactor;
      });
    }

    if (sortBy === "release-date") {
      return items.sort((a, b) => {
        const aDate = Date.parse(a.release_date || a.first_air_date || "");
        const bDate = Date.parse(b.release_date || b.first_air_date || "");
        const aValid = Number.isFinite(aDate);
        const bValid = Number.isFinite(bDate);

        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        return (aDate - bDate) * directionFactor;
      });
    }

    return items;
  }, [filteredResults, sortBy, sortDirection]);

  const filterCounts = useMemo(
    () =>
      results.reduce(
        (acc, item) => {
          if (item.mediaType === "movie") acc.movie += 1;
          else if (item.mediaType === "tv") acc.tv += 1;
          else if (item.mediaType === "person") acc.person += 1;
          acc.all += 1;
          return acc;
        },
        { all: 0, movie: 0, tv: 0, person: 0 },
      ),
    [results],
  );

  const resultLabel = useMemo(() => {
    if (!query) return "Type a query in the top search bar.";
    if (isLoading) return "Searching...";
    if (!results.length) return "No results found.";
    if (!filteredResults.length) {
      const typeLabel =
        activeFilter === "movie"
          ? "movies"
          : activeFilter === "tv"
            ? "shows"
            : "people";
      return `No ${typeLabel} found for "${query}".`;
    }
    return `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"} for "${query}"`;
  }, [query, isLoading, results.length, filteredResults.length, activeFilter]);

  const savedMap = useMemo(() => {
    const next = {};
    savedItems.forEach((entry) => {
      if (!entry?.id || !entry?.mediaType) return;
      next[`${entry.mediaType}:${entry.id}`] = entry;
    });
    return next;
  }, [savedItems]);

  const isManageable = (item) =>
    item.mediaType === "movie" || item.mediaType === "tv";

  const isUnreleased = (item) => {
    const dateRaw = item.release_date || item.first_air_date;
    if (!dateRaw) return false;
    const release = new Date(`${dateRaw}T00:00:00`);
    if (Number.isNaN(release.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return release.getTime() > today.getTime();
  };

  const getItemKey = (item) => `${item.mediaType}:${item.id}`;

  const getCurrentStatus = (item) => {
    const key = getItemKey(item);
    if (Object.prototype.hasOwnProperty.call(localStatusMap, key)) {
      return localStatusMap[key] || "";
    }
    const savedStatus = savedMap[key]?.status;
    return savedStatus === "Watched" ? "Finished" : savedStatus || "";
  };

  const getCurrentFavourite = (item) => {
    const key = getItemKey(item);
    if (Object.prototype.hasOwnProperty.call(localFavouriteMap, key)) {
      return Boolean(localFavouriteMap[key]);
    }
    return Boolean(savedMap[key]?.favourite);
  };

  const getCurrentRating = (item) => {
    const key = getItemKey(item);
    if (Object.prototype.hasOwnProperty.call(localRatingMap, key)) {
      return Number(localRatingMap[key] || 0);
    }
    return Number(ratingsMap[key] || 0);
  };

  const getCurrentNotInterested = (item) => {
    const key = getItemKey(item);
    if (Object.prototype.hasOwnProperty.call(localNotInterestedMap, key)) {
      return Boolean(localNotInterestedMap[key]);
    }
    return Boolean(savedMap[key]?.notInterested);
  };

  const hasDatabaseEntry = (item) => {
    if (item.mediaType === "person") {
      const actorKey = String(item.id);
      return (
        Boolean(likedActorsMap[actorKey]) ||
        Number(actorRatingsMap[actorKey] || 0) > 0
      );
    }

    const key = getItemKey(item);
    return Boolean(savedMap[key]) || getCurrentRating(item) > 0;
  };

  const saveStatus = async (item, nextStatus) => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!isManageable(item)) return;

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";
    const typeDoc = mediaType === "tv" ? "shows" : "movies";
    const key = getItemKey(item);
    const prevStatus = getCurrentStatus(item);
    const shouldClearNotInterested = nextStatus !== "Dropped";
    setLocalStatusMap((prev) => ({ ...prev, [key]: nextStatus }));
    if (shouldClearNotInterested) {
      setLocalNotInterestedMap((prev) => ({ ...prev, [key]: false }));
    }

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );
      await setDoc(
        ref,
        {
          id: Number(item.id),
          title: item.title || item.name,
          poster: item.poster_path || null,
          backdrop: item.backdrop_path || null,
          overview: item.overview || null,
          releaseDate: item.release_date || item.first_air_date || null,
          rating: item.vote_average ?? null,
          mediaType,
          status: nextStatus || null,
          notInterested: shouldClearNotInterested
            ? false
            : getCurrentNotInterested(item),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      setLocalStatusMap((prev) => ({ ...prev, [key]: prevStatus }));
      if (shouldClearNotInterested) {
        setLocalNotInterestedMap((prev) => ({
          ...prev,
          [key]: getCurrentNotInterested(item),
        }));
      }
      toast.error("Failed to update status");
    }
  };

  const toggleFavourite = async (item) => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!isManageable(item)) return;
    if (isUnreleased(item)) {
      toast("Favourites unlock on release", { icon: "i" });
      return;
    }

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";
    const typeDoc = mediaType === "tv" ? "shows" : "movies";
    const key = getItemKey(item);
    const prevFav = getCurrentFavourite(item);
    const nextFav = !prevFav;
    setLocalFavouriteMap((prev) => ({ ...prev, [key]: nextFav }));

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );
      await setDoc(
        ref,
        {
          id: Number(item.id),
          title: item.title || item.name,
          poster: item.poster_path || null,
          backdrop: item.backdrop_path || null,
          overview: item.overview || null,
          releaseDate: item.release_date || item.first_air_date || null,
          rating: item.vote_average ?? null,
          mediaType,
          status: getCurrentStatus(item) || null,
          favourite: nextFav,
          notInterested: getCurrentNotInterested(item),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      setLocalFavouriteMap((prev) => ({ ...prev, [key]: prevFav }));
      toast.error("Failed to update favourite");
    }
  };

  const saveRating = async (item, value) => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!isManageable(item)) return;
    if (isUnreleased(item)) {
      toast("Rating unlocks when this title releases.", { icon: "i" });
      return;
    }

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";
    const ratingTypeDoc = mediaType === "tv" ? "shows" : "movies";
    const key = getItemKey(item);
    const prevRating = getCurrentRating(item);
    const prevNotInterested = getCurrentNotInterested(item);
    const clamped = Math.max(0, Math.min(5, Number(value) || 0));
    setLocalRatingMap((prev) => ({ ...prev, [key]: clamped }));
    if (clamped > 0 && prevNotInterested) {
      setLocalNotInterestedMap((prev) => ({ ...prev, [key]: false }));
    }

    try {
      const ref = doc(
        db,
        ...profileRatingItemPath(
          user.email,
          activeProfileId,
          ratingTypeDoc,
          item.id,
        ),
      );
      if (clamped === 0) {
        await deleteDoc(ref);
        return;
      }
      await setDoc(
        ref,
        {
          id: Number(item.id),
          title: item.title || item.name,
          mediaType,
          mode: "stars",
          value: clamped,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (clamped > 0 && prevNotInterested) {
        const savedTypeDoc = mediaType === "tv" ? "shows" : "movies";
        const savedRef = doc(
          db,
          ...profileSavedItemPath(
            user.email,
            activeProfileId,
            savedTypeDoc,
            item.id,
          ),
        );
        await setDoc(savedRef, { notInterested: false }, { merge: true });
      }
    } catch {
      setLocalRatingMap((prev) => ({ ...prev, [key]: prevRating }));
      if (clamped > 0 && prevNotInterested) {
        setLocalNotInterestedMap((prev) => ({
          ...prev,
          [key]: prevNotInterested,
        }));
      }
      toast.error("Failed to save rating");
    }
  };

  const toggleNotInterested = async (item) => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!isManageable(item)) return;
    const currentStatus = getCurrentStatus(item);
    if (currentStatus !== "Dropped") {
      toast("Set status to Dropped first", { icon: "i" });
      return;
    }

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";
    const typeDoc = mediaType === "tv" ? "shows" : "movies";
    const key = getItemKey(item);
    const prev = getCurrentNotInterested(item);
    const next = !prev;
    setLocalNotInterestedMap((state) => ({ ...state, [key]: next }));

    try {
      const savedRef = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );
      await setDoc(
        savedRef,
        {
          id: Number(item.id),
          title: item.title || item.name,
          poster: item.poster_path || null,
          backdrop: item.backdrop_path || null,
          overview: item.overview || null,
          releaseDate: item.release_date || item.first_air_date || null,
          rating: item.vote_average ?? null,
          mediaType,
          status: currentStatus,
          favourite: getCurrentFavourite(item),
          notInterested: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (next) {
        const ratingTypeDoc = mediaType === "tv" ? "shows" : "movies";
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            user.email,
            activeProfileId,
            ratingTypeDoc,
            item.id,
          ),
        );
        await deleteDoc(ratingRef);
        setLocalRatingMap((state) => ({ ...state, [key]: 0 }));
      }
    } catch {
      setLocalNotInterestedMap((state) => ({ ...state, [key]: prev }));
      toast.error("Failed to update preference");
    }
  };
  const removeFromDatabase = async (item) => {
    if (!item) return;
    if (!user?.email) {
      toast.error("Login required");
      return;
    }

    try {
      if (item.mediaType === "person") {
        const likedRef = doc(
          db,
          ...profileLikedActorItemPath(user.email, activeProfileId, item.id),
        );
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            user.email,
            activeProfileId,
            "actors",
            item.id,
          ),
        );

        await Promise.all([deleteDoc(likedRef), deleteDoc(ratingRef)]);
        toast.success(`Removed ${item.name || "person"} from your database`);
      } else {
        const typeDoc = item.mediaType === "tv" ? "shows" : "movies";
        const savedRef = doc(
          db,
          ...profileSavedItemPath(
            user.email,
            activeProfileId,
            typeDoc,
            item.id,
          ),
        );
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            user.email,
            activeProfileId,
            typeDoc,
            item.id,
          ),
        );

        await Promise.all([deleteDoc(savedRef), deleteDoc(ratingRef)]);

        const key = getItemKey(item);
        setLocalStatusMap((prev) => ({ ...prev, [key]: "" }));
        setLocalFavouriteMap((prev) => ({ ...prev, [key]: false }));
        setLocalRatingMap((prev) => ({ ...prev, [key]: 0 }));
        setLocalNotInterestedMap((prev) => ({ ...prev, [key]: false }));
        toast.success(
          `Removed ${item.title || item.name || "title"} from your database`,
        );
      }
    } catch {
      toast.error("Failed to remove item");
      return;
    }

    setRemoveTarget(null);
  };
  return (
    <div className="pt-24 pb-12 px-6 lg:px-10 min-h-screen bg-[#0b0b0b] text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-white/65 mt-2">{resultLabel}</p>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-white/70">
            <ImSpinner2 className="animate-spin" />
            Fetching results
          </div>
        ) : (
          <>
            {!query && recentSearches.length > 0 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-wide text-white/50 mb-3">
                  Recent searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <Link
                      key={term}
                      to={`/search?q=${encodeURIComponent(term)}`}
                      className="px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-sm text-white/85 hover:bg-white/[0.08] transition"
                    >
                      {term}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!!query && results.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {SEARCH_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      activeFilter === filter.key
                        ? "bg-red-600 text-white shadow-lg shadow-red-700/25"
                        : "bg-white/10 hover:bg-white/20 text-white/80"
                    }`}
                  >
                    {filter.label} ({filterCounts[filter.key]})
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 text-xs text-white/60">
                  <span className="hidden sm:inline">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white outline-none transition hover:bg-white/15"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option
                        key={option.key}
                        value={option.key}
                        className="bg-[#111] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {sortBy !== "best-match" && (
                    <button
                      type="button"
                      onClick={() =>
                        setSortDirection((prev) =>
                          prev === "asc" ? "desc" : "asc",
                        )
                      }
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                      title={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
                    >
                      {sortDirection === "asc" ? "Asc" : "Desc"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedResults.map((item) => {
                const mediaLabel =
                  item.mediaType === "movie"
                    ? "Movie"
                    : item.mediaType === "tv"
                      ? "Series"
                      : "Person";
                const href =
                  item.mediaType === "movie"
                    ? `/movies/${item.id}`
                    : item.mediaType === "tv"
                      ? `/shows/${item.id}`
                      : `/person/${item.id}`;
                const imagePath = item.poster_path || item.profile_path;
                const subtitle =
                  item.mediaType === "movie"
                    ? item.release_date?.slice(0, 4) || "Release date unknown"
                    : item.mediaType === "tv"
                      ? item.first_air_date?.slice(0, 4) ||
                        "First air date unknown"
                      : item.known_for_department || "Known for";
                const knownForText = formatKnownFor(item);
                const description =
                  item.overview?.trim() ||
                  (item.mediaType === "person"
                    ? knownForText && `Known for: ${knownForText}`
                    : "") ||
                  "No description available.";
                const inLibrary = hasDatabaseEntry(item);

                return (
                  <article
                    key={`${item.mediaType}-${item.id}`}
                    className="relative rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <AnimatePresence initial={false}>
                      {inLibrary && (
                        <motion.button
                          key={`trash-${item.mediaType}-${item.id}`}
                          type="button"
                          onClick={() => setRemoveTarget(item)}
                          title="Remove from database"
                          initial={{ opacity: 0, x: 14, scale: 0.92 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 14, scale: 0.92 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className={`absolute top-2.5 z-10 h-8 w-8 rounded-full border border-white/30 bg-black/65 text-white/85 hover:bg-red-700/90 ${
                            isManageable(item) ? "right-12" : "right-2.5"
                          }`}
                        >
                          <FaTrash size={12} className="mx-auto" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                    {isManageable(item) && (
                      <button
                        type="button"
                        onClick={() => toggleFavourite(item)}
                        title={
                          isUnreleased(item)
                            ? "Favourites unlock on release"
                            : getCurrentFavourite(item)
                              ? "Remove favourite"
                              : "Add favourite"
                        }
                        className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full border flex items-center justify-center transition ${
                          isUnreleased(item)
                            ? "bg-black/60 border-white/25 text-white/40"
                            : getCurrentFavourite(item)
                              ? "bg-red-600/90 border-red-300/60 text-white"
                              : "bg-black/65 border-white/30 text-white/85 hover:bg-black/85"
                        }`}
                      >
                        {getCurrentFavourite(item) ? (
                          <FaHeart size={12} />
                        ) : (
                          <FaRegHeart size={12} />
                        )}
                      </button>
                    )}
                    <Link
                      to={href}
                      className="group flex gap-3 hover:bg-white/[0.02] rounded-lg transition"
                    >
                      <img
                        src={
                          imagePath
                            ? `https://image.tmdb.org/t/p/w154${imagePath}`
                            : NotFoundPlaceholder
                        }
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = NotFoundPlaceholder;
                        }}
                        className="w-16 h-24 rounded object-cover bg-white/10 shrink-0"
                      />

                      <div className="min-w-0">
                        <motion.p
                          className="truncate text-sm font-semibold text-white group-hover:text-red-300"
                          style={{
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                          animate={{ maxWidth: inLibrary ? 195 : 230 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                          {item.title || item.name}
                        </motion.p>
                        <p className="mt-1 text-xs text-white/50 uppercase tracking-wide">
                          {mediaLabel}
                        </p>
                        {subtitle && (
                          <p className="mt-1 text-xs text-white/65 truncate">
                            {subtitle}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-white/60 line-clamp-3">
                          {description}
                        </p>
                      </div>
                    </Link>

                    {isManageable(item) ? (
                      <div className="mt-3 border-t border-white/10">
                        <div className="flex justify-center items-center gap-2 my-3">
                          {STATUS_BUTTONS.map((status) => (
                            <button
                              key={status.key}
                              type="button"
                              onClick={() => saveStatus(item, status.key)}
                              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition ${
                                getCurrentStatus(item) === status.key
                                  ? "bg-red-600 text-white shadow-lg shadow-red-700/25"
                                  : "bg-white/10 hover:bg-white/20 text-neutral-200"
                              }`}
                            >
                              {status.label}
                            </button>
                          ))}
                        </div>
                        <PersonalRating
                          className="mt-2"
                          starSizeClass="text-2xl"
                          value={getCurrentRating(item)}
                          onRate={(value) => saveRating(item, value)}
                          disabled={!user?.email || isUnreleased(item)}
                          disabledLabel={
                            !user?.email
                              ? "Sign in to rate."
                              : "Rating opens after release."
                          }
                          disabledToastMessage={
                            !user?.email
                              ? "Login required"
                              : "Rating unlocks on release"
                          }
                          showNotInterestedToggle={
                            getCurrentStatus(item) === "Dropped"
                          }
                          notInterested={getCurrentNotInterested(item)}
                          onToggleNotInterested={() =>
                            toggleNotInterested(item)
                          }
                          notInterestedDisabled={!user?.email}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-white/45">
                        Open profile to view person details.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      <RemoveConfirmModal
        open={Boolean(removeTarget)}
        item={removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeFromDatabase(removeTarget)}
      />
    </div>
  );
};

export default Search;
