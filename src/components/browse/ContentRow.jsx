import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { motion } from "framer-motion";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import PosterCard from "./PosterCard";
import { db } from "../../firebase";
import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import {
  profileSavedItemPath,
  resolveProfileId,
} from "../../utils/profileFirestorePaths";

const STATUS_MAP = {
  want: "Want to Watch",
  "want to watch": "Want to Watch",
  watching: "Watching",
  watched: "Watched",
  paused: "Paused",
  dropped: "Dropped",
};

const normalizeStatus = (status) => {
  if (!status) return null;
  return STATUS_MAP[String(status).trim().toLowerCase()] ?? status;
};

const normalizeMediaType = (mediaType) => {
  const value = String(mediaType || "").toLowerCase();
  if (value === "tv" || value === "show" || value === "shows") return "tv";
  return "movie";
};

const parseReleaseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isItemUnreleased = (item) => {
  const rawDate = item.releaseDate || item.release_date || item.first_air_date;
  const releaseDate = parseReleaseDate(rawDate);
  if (!releaseDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return releaseDate > today;
};

const buildPagedUrl = (rawUrl, page) => {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("page", String(page));
    return url.toString();
  } catch {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}page=${page}`;
  }
};

const filterResultsForCategory = (results, rawUrl) => {
  const isUpcomingMovies = rawUrl.includes("/movie/upcoming");
  if (!isUpcomingMovies) return results;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return results.filter((item) => {
    if (!item.release_date) return false;
    const release = new Date(`${item.release_date}T00:00:00`);
    return !Number.isNaN(release.getTime()) && release >= today;
  });
};

const mergeUniqueById = (list) =>
  Array.from(new Map(list.map((item) => [String(item.id), item])).values());

const isUpcomingMoviesUrl = (rawUrl) => rawUrl.includes("/movie/upcoming");

const ContentRow = ({ title, fetchURL, savedItems = [], onStatusChange }) => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const sliderRef = useRef(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const [localStatusMap, setLocalStatusMap] = useState({});
  const [localFavouriteMap, setLocalFavouriteMap] = useState({});
  const [pendingRemove, setPendingRemove] = useState(null);
  const activeProfileId = resolveProfileId(selectedProfile);

  const fetchPage = useCallback(
    async (targetPage, append = false) => {
      if (!fetchURL) return;
      const res = await axios.get(buildPagedUrl(fetchURL, targetPage));
      const nextResults = filterResultsForCategory(
        res.data.results || [],
        fetchURL,
      );
      setTotalPages(res.data.total_pages || 1);
      setPage(targetPage);
      setItems((prev) => {
        if (!append) return nextResults;
        const merged = [...prev, ...nextResults];
        return Array.from(new Map(merged.map((i) => [String(i.id), i])).values());
      });
    },
    [fetchURL],
  );

  useEffect(() => {
    if (!fetchURL) return;
    let cancelled = false;
    setShowLoadMore(false);

    const loadInitial = async () => {
      try {
        if (!isUpcomingMoviesUrl(fetchURL)) {
          await fetchPage(1, false);
          return;
        }

        let targetPage = 1;
        let maxPages = 1;
        let collected = [];
        const minInitialItems = 12;

        while (targetPage <= maxPages) {
          const res = await axios.get(buildPagedUrl(fetchURL, targetPage));
          const filtered = filterResultsForCategory(
            res.data.results || [],
            fetchURL,
          );
          maxPages = res.data.total_pages || 1;
          collected = mergeUniqueById([...collected, ...filtered]);

          if (collected.length >= minInitialItems || targetPage >= maxPages) {
            break;
          }
          targetPage += 1;
        }

        if (cancelled) return;
        setItems(collected);
        setTotalPages(maxPages);
        setPage(targetPage);
      } catch {
        if (cancelled) return;
        setItems([]);
        setTotalPages(1);
        setPage(1);
      }
    };

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, fetchURL]);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return undefined;

    const updateLoadMoreVisibility = () => {
      const reachedEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 16;
      setShowLoadMore(reachedEnd);
    };

    updateLoadMoreVisibility();
    el.addEventListener("scroll", updateLoadMoreVisibility);
    window.addEventListener("resize", updateLoadMoreVisibility);
    return () => {
      el.removeEventListener("scroll", updateLoadMoreVisibility);
      window.removeEventListener("resize", updateLoadMoreVisibility);
    };
  }, [items.length]);

  /** 🔥 MERGE TMDB + FIREBASE */
  const mergedItems = useMemo(() => {
    if (!items.length) return [];

    const savedMap = new Map();
    savedItems.forEach((savedItem) => {
      const id = String(savedItem.id);
      const mediaType = normalizeMediaType(savedItem.mediaType);
      savedMap.set(`${mediaType}:${id}`, savedItem);
      if (!savedMap.has(id)) savedMap.set(id, savedItem);
    });

    return items.map((item) => {
      const mediaType =
        item.media_type === "tv" || item.first_air_date ? "tv" : "movie";
      const id = String(item.id);
      const saved = savedMap.get(`${mediaType}:${id}`) ?? savedMap.get(id);
      const localKey = `${mediaType}:${id}`;
      const localStatus = localStatusMap[localKey];
      const localFavourite = localFavouriteMap[localKey];

      return {
        ...item,
        mediaType,
        status: normalizeStatus(localStatus ?? saved?.status ?? null),
        isSaved: localStatus ? true : Boolean(saved),
        favourite:
          typeof localFavourite === "boolean"
            ? localFavourite
            : Boolean(saved?.favourite),
        poster: saved?.poster ?? item.poster_path ?? item.poster,
        release_date:
          saved?.releaseDate ?? item.release_date ?? item.first_air_date,
        isUnreleased: isItemUnreleased({
          releaseDate: saved?.releaseDate ?? item.releaseDate,
          release_date: item.release_date,
          first_air_date: item.first_air_date,
        }),
      };
    });
  }, [items, savedItems, localStatusMap, localFavouriteMap]);

  if (!mergedItems.length) return null;

  const slideLeft = () => {
    sliderRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  };

  const slideRight = () => {
    sliderRef.current?.scrollBy({ left: 600, behavior: "smooth" });
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;
    if (page >= totalPages) return;
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, true);
    } catch {
      toast.error("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleStatusChange = async (item, status) => {
    if (onStatusChange) {
      await onStatusChange(item, status);
      return;
    }

    if (!user?.email) {
      toast.error("Login required");
      return;
    }

    const mediaType = normalizeMediaType(
      item.mediaType ||
        item.media_type ||
        (item.first_air_date ? "tv" : "movie"),
    );
    const itemId = String(item.id);
    const localKey = `${mediaType}:${itemId}`;
    const typeDoc = mediaType === "tv" ? "shows" : "movies";

    if (!status) {
      setPendingRemove({ item, localKey, typeDoc, itemId });
      return;
    }

    setLocalStatusMap((prev) => ({ ...prev, [localKey]: status }));

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, itemId),
      );

      await setDoc(
        ref,
        {
          id: Number(item.id),
          title: item.title || item.name,
          poster: item.poster_path || item.poster || null,
          backdrop: item.backdrop_path || item.backdrop || null,
          overview: item.overview || null,
          runtime:
            item.runtime ||
            (Array.isArray(item.episode_run_time)
              ? item.episode_run_time[0]
              : null),
          releaseDate:
            item.release_date ||
            item.first_air_date ||
            item.releaseDate ||
            null,
          rating: item.vote_average ?? item.rating ?? null,
          mediaType,
          status,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      toast.success(`${item.title} is now in your watchlist`);
    } catch (err) {
      setLocalStatusMap((prev) => {
        const next = { ...prev };
        delete next[localKey];
        return next;
      });
      toast.error("Failed to update status");
    }
  };

  const confirmRemove = async () => {
    if (!pendingRemove || !user?.email) return;

    const { item, localKey, typeDoc, itemId } = pendingRemove;
    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, typeDoc, itemId),
    );

    try {
      await deleteDoc(ref);
      setLocalStatusMap((prev) => {
        const next = { ...prev };
        next[localKey] = null;
        return next;
      });
      setLocalFavouriteMap((prev) => {
        const next = { ...prev };
        next[localKey] = false;
        return next;
      });
      toast.success(`${item.title} is now removed from your watchlist`);
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setPendingRemove(null);
    }
  };

  const handleFavouriteToggle = async (item, favourite) => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (isItemUnreleased(item)) {
      toast("Favourites unlock on release", { icon: "🔒" });
      return;
    }

    const mediaType = normalizeMediaType(
      item.mediaType ||
        item.media_type ||
        (item.first_air_date ? "tv" : "movie"),
    );
    const itemId = String(item.id);
    const localKey = `${mediaType}:${itemId}`;
    const typeDoc = mediaType === "tv" ? "shows" : "movies";

    setLocalFavouriteMap((prev) => ({ ...prev, [localKey]: favourite }));

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, itemId),
      );

      await setDoc(
        ref,
        {
          id: Number(item.id),
          title: item.title || item.name,
          poster: item.poster_path || item.poster || null,
          backdrop: item.backdrop_path || item.backdrop || null,
          overview: item.overview || null,
          runtime:
            item.runtime ||
            (Array.isArray(item.episode_run_time)
              ? item.episode_run_time[0]
              : null),
          releaseDate:
            item.release_date ||
            item.first_air_date ||
            item.releaseDate ||
            null,
          rating: item.vote_average ?? item.rating ?? null,
          mediaType,
          status: item.status ?? null,
          favourite,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast.success(
        favourite
          ? `${item.title} is now a favourite`
          : `${item.title} is now removed from your favourites`,
        {
          icon: favourite ? "😍" : "💔",
        },
      );
    } catch {
      setLocalFavouriteMap((prev) => {
        const next = { ...prev };
        delete next[localKey];
        return next;
      });
      toast.error("Failed to update favourite");
    }
  };

  return (
    <section className="relative p-3 select-none">
      <div className="mb-4 px-1 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white flex-1 min-w-0 truncate pr-3">
          {title}
        </h2>
        {showLoadMore && page < totalPages && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="
              shrink-0
              px-4 py-2 rounded-full text-sm font-medium
              bg-white/15 hover:bg-white/25
              border border-white/20
              shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)]
              animate-pulse
              disabled:opacity-60 disabled:cursor-not-allowed
              transition
            "
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <MdChevronLeft
          onMouseDown={(e) => e.preventDefault()}
          onClick={slideLeft}
          size={42}
          className="
            absolute left-0 top-1/2 -translate-y-1/2 z-10
            bg-black/60 hover:bg-black/80 rounded-full cursor-pointer
            opacity-80 hover:opacity-100 transition
          "
        />

        <div
          ref={sliderRef}
          className="
            flex gap-4 overflow-x-scroll scroll-smooth
            scrollbar-hide px-2 mb-4 select-none
          "
        >
          {mergedItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
            >
              <PosterCard
                item={item}
                onStatusChange={handleStatusChange}
                onFavouriteToggle={handleFavouriteToggle}
              />
            </motion.div>
          ))}
        </div>

        <MdChevronRight
          onMouseDown={(e) => e.preventDefault()}
          onClick={slideRight}
          size={42}
          className="
            absolute right-0 top-1/2 -translate-y-1/2 z-10
            bg-black/60 hover:bg-black/80 rounded-full cursor-pointer
            opacity-80 hover:opacity-100 transition
          "
        />
      </motion.div>

      {pendingRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#111] p-5">
            <h3 className="text-lg font-semibold mb-2">Remove from list?</h3>
            <p className="text-sm text-white/70">
              Remove{" "}
              <span className="text-white">
                {pendingRemove.item.title || pendingRemove.item.name}
              </span>{" "}
              from your saved list?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingRemove(null)}
                className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ContentRow;
