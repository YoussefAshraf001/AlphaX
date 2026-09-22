import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { Link } from "react-router-dom";
import { MdChevronLeft, MdChevronRight, MdClose } from "react-icons/md";
import { playbackSummary } from "../../utils/playbackProgress";
import { FaPlay } from "react-icons/fa";
import toast from "react-hot-toast";
import { isContinueWatchingVisible } from "../../utils/continueWatching";
import {
  applyCheckpoint,
  profileCheckpoints,
  CHECKPOINT_EVENT,
} from "../../utils/playbackCheckpoint";
import {
  profileSavedCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../../utils/profileFirestorePaths";

const ContinueWatchingRow = ({ mediaFilter = "all" }) => {
  const { user, loading } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const [items, setItems] = useState([]);
  const [removing, setRemoving] = useState(new Set());
  const [showCarouselControls, setShowCarouselControls] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const sliderRef = useRef(null);
  const activeProfileId = resolveProfileId(selectedProfile);
  const scope = `${user?.email || "guest"}:${activeProfileId}:${mediaFilter}`;
  const [snapshotState, setSnapshotState] = useState({ scope: null, ready: false, error: false });
  const [retry, setRetry] = useState(0);
  const rowLoading = loading || profileLoading || (Boolean(user?.email) && (snapshotState.scope !== scope || !snapshotState.ready));

  useEffect(() => {
    setItems([]);
    setSnapshotState({ scope, ready: false, error: false });
    if (loading || profileLoading || !user?.email) return;
    const movieRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "shows"),
    );

    const shouldIncludeMovies =
      mediaFilter === "all" || mediaFilter === "movie";
    const shouldIncludeShows = mediaFilter === "all" || mediaFilter === "tv";

    let movies = [];
    let shows = [];
    let moviesReady = !shouldIncludeMovies;
    let showsReady = !shouldIncludeShows;
    let snapshotError = false;

    const sync = () => {
      const byTitle = new Map(
        [...movies, ...shows].map((item) => [
          `${item.mediaType}:${item.id}`,
          item,
        ]),
      );
      profileCheckpoints(user.email, activeProfileId).forEach((checkpoint) => {
        const meta = checkpoint.metadata;
        if (!meta || (mediaFilter !== "all" && mediaFilter !== meta.mediaType))
          return;
        const key = `${meta.mediaType}:${meta.id}`;
        byTitle.set(key, applyCheckpoint(byTitle.get(key), checkpoint));
      });
      const merged = [...byTitle.values()]
        .filter(isContinueWatchingVisible)
        .sort(
          (a, b) =>
            (b.lastWatchedAt?.seconds || b.updatedAt?.seconds || 0) -
            (a.lastWatchedAt?.seconds || a.updatedAt?.seconds || 0),
        );
      setItems(merged);
      setSnapshotState({ scope, ready: moviesReady && showsReady, error: snapshotError });
    };
    sync();
    window.addEventListener(CHECKPOINT_EVENT, sync);
    window.addEventListener("storage", sync);

    const unsubMovies = shouldIncludeMovies
      ? onSnapshot(
          movieRef,
          (snap) => {
            movies = snap.docs.map((d) => ({
              id: d.id,
              mediaType: "movie",
              ...d.data(),
            }));
            moviesReady = true;
            sync();
          },
          (err) => {
            console.error("CW movies snapshot error:", err);
            moviesReady = true;
            snapshotError = true;
            sync();
          },
        )
      : () => {};

    const unsubShows = shouldIncludeShows
      ? onSnapshot(
          showRef,
          (snap) => {
            shows = snap.docs.map((d) => ({
              id: d.id,
              mediaType: "tv",
              ...d.data(),
            }));
            showsReady = true;
            sync();
          },
          (err) => {
            console.error("CW shows snapshot error:", err);
            showsReady = true;
            snapshotError = true;
            sync();
          },
        )
      : () => {};

    return () => {
      unsubMovies();
      unsubShows();
      window.removeEventListener(CHECKPOINT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [user?.email, loading, mediaFilter, activeProfileId, profileLoading, scope, retry]);

  const slideLeft = () => {
    sliderRef.current?.scrollBy({ left: -620, behavior: "smooth" });
  };

  const removalKey = (item) =>
    `${user?.email}:${activeProfileId}:${item.mediaType}:${item.id}`;
  const visibleItems = !loading && !profileLoading && snapshotState.scope === scope
    ? items.filter((item) => !removing.has(removalKey(item)))
    : [];

  const removeFromContinueWatching = async (item) => {
    if (!user?.email) return;
    const key = removalKey(item);
    if (removing.has(key)) return;
    setRemoving((previous) => new Set(previous).add(key));
    try {
      await setDoc(
        doc(
          db,
          ...profileSavedItemPath(
            user.email,
            activeProfileId,
            item.mediaType === "tv" ? "shows" : "movies",
            item.id,
          ),
        ),
        {
          id: item.id,
          title: item.title || item.name || "Untitled",
          mediaType: item.mediaType,
          status: item.status || "Watching",
          continueWatchingHiddenAtMs: Date.now(),
        },
        { merge: true },
      );
      toast.success("Removed from Continue Watching");
    } catch {
      toast.error("Could not remove this title. Please try again.");
    } finally {
      setRemoving((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  const slideRight = () => {
    sliderRef.current?.scrollBy({ left: 620, behavior: "smooth" });
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return undefined;

    const updateControls = () => {
      const hasOverflow = el.scrollWidth - el.clientWidth > 8;
      setShowCarouselControls(hasOverflow);
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };

    updateControls();
    el.addEventListener("scroll", updateControls);
    window.addEventListener("resize", updateControls);
    return () => {
      el.removeEventListener("scroll", updateControls);
      window.removeEventListener("resize", updateControls);
    };
  }, [visibleItems.length]);

  return (
    <section aria-label="Continue Watching" aria-busy={rowLoading} className="px-4 sm:px-10 mb-10 relative group">
      <h2 className="text-lg font-semibold mb-4 tracking-wide">
        Continue Watching
      </h2>

      {visibleItems.length > 0 && showCarouselControls && (
        <>
          <button
            onClick={slideLeft}
            disabled={!canScrollLeft}
            className="hidden md:flex absolute left-7 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white/85 opacity-0 group-hover:opacity-100 transition hover:bg-black/90 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Scroll left"
          >
            <MdChevronLeft size={24} />
          </button>
          <button
            onClick={slideRight}
            disabled={!canScrollRight}
            className="hidden md:flex absolute right-7 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/70 border border-white/20 text-white/85 opacity-0 group-hover:opacity-100 transition hover:bg-black/90 disabled:opacity-0 disabled:pointer-events-none"
            aria-label="Scroll right"
          >
            <MdChevronRight size={24} />
          </button>
        </>
      )}

      <div className="h-[170px] sm:h-[180px]">
      {!visibleItems.length ? (
        rowLoading ? (
          <div role="status" aria-label="Loading Continue Watching" className="flex h-full gap-4 overflow-hidden">
            {[0, 1, 2, 3, 4].map((item) => <div key={item} aria-hidden="true" className="h-full w-[260px] sm:w-[292px] shrink-0 rounded-lg bg-white/5 animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
            <p className="text-base sm:text-lg text-white/50">{snapshotState.error ? "Your watch history couldn't load." : "Pick what to see next."}</p>
            {snapshotState.error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="text-sm text-white/75 hover:text-white">Retry</button>}
          </div>
        )
      ) : <div
        ref={sliderRef}
        className="flex gap-4 overflow-x-scroll scroll-smooth scrollbar-hide px-[5px] pt-3 pb-[18px] -mx-[5px] -mt-3 -mb-[18px] snap-x snap-proximity"
      >
        {visibleItems.map((item) => {
          const image =
            item.backdrop ||
            item.backdrop_path ||
            item.poster ||
            item.poster_path ||
            null;
          const totalEpisodes = Number(item.totalEpisodes || 0);
          const watchedEpisodes = Number(item.watchedEpisodes || 0);
          const clampedWatched = Math.max(
            0,
            Math.min(watchedEpisodes, totalEpisodes || watchedEpisodes),
          );
          const computedProgress =
            item.mediaType === "tv" && totalEpisodes > 0
              ? Math.round((clampedWatched / totalEpisodes) * 100)
              : item.status === "Finished" || item.status === "Watched"
                ? 100
                : 45;
          const actualProgress = playbackSummary(item);
          const progressPercent = item.playback
            ? actualProgress.percent
            : item.mediaType === "tv"
              ? Math.max(0, Math.min(computedProgress, 100))
              : 0;
          const currentSeason = Number(item.currentSeason || 0);
          const currentEpisode = Number(item.currentEpisode || 0);
          const progressLabel =
            item.mediaType === "tv" &&
            Number.isFinite(currentSeason) &&
            Number.isFinite(currentEpisode) &&
            currentSeason > 0 &&
            currentEpisode > 0
              ? `S${currentSeason} • E${currentEpisode}`
              : item.mediaType === "tv" && totalEpisodes > 0
                ? `${clampedWatched}/${totalEpisodes} eps`
                : item.status;

          return (
            <div
              key={`${item.mediaType}-${item.id}`}
              className="group/card relative isolate shrink-0 w-[260px] sm:w-[292px] h-[170px] sm:h-[180px] 
              snap-start rounded-lg bg-neutral-800 ring-1 ring-white/10 
              transition-transform duration-300 
              hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:transform-none"
            >
              <Link
                to={
                  item.mediaType === "tv"
                    ? `/shows/${item.id}?resume=1`
                    : `/movies/${item.id}?resume=1`
                }
                className="absolute inset-0 overflow-hidden rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
                aria-label={`Continue ${item.title || item.name}, ${item.playback ? actualProgress.label : progressLabel}`}
              >
                {/* IMAGE */}
                {image ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500/${image}`}
                    alt={item.title || item.name}
                    className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover/card:scale-105 group-hover/card:brightness-75 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    ▶
                  </div>
                )}

                {/* GRADIENT */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/60 to-transparent" />
                <div>
                  <span
                    className="absolute top-16 left-24 flex items-center gap-2.5 text-xs font-semibold opacity-100 md:opacity-0 md:translate-y-2 group-hover/card:opacity-100 group-hover/card:translate-y-0 group-focus-within/card:opacity-100 group-focus-within/card:translate-y-0 transition duration-300 motion-reduce:transition-none"
                    aria-hidden="true"
                  >
                    <span className="grid place-items-center w-[38px] h-[38px] rounded-full bg-white text-neutral-900 [&>svg]:w-3 [&>svg]:ml-0.5">
                      <FaPlay />
                    </span>
                    Resume
                  </span>

                </div>

                {/* TEXT */}
                <div className="absolute left-[18px] right-[18px] bottom-[22px] [&>p:first-child]:text-base [&>p:last-child]:mt-1.5 [&>p:last-child]:text-zinc-300">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">
                    {item.title || item.name}
                  </p>

                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    {item.playback ? actualProgress.label : progressLabel}
                  </p>
                </div>

                {/* PROGRESS BAR */}
                <div className="absolute left-[18px] right-[18px] bottom-[11px] h-[3px] rounded-lg bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </Link>
              <button
                type="button"
                onClick={() => removeFromContinueWatching(item)}
                title="Remove from Continue Watching"
                aria-label={`Remove ${item.title || item.name} from Continue Watching`}
                className="absolute top-2 right-2 z-10 grid place-items-center w-8 h-8 rounded-full bg-black/70 text-white/80 hover:bg-red-600 hover:text-white md:opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white transition-opacity motion-reduce:transition-none"
              >
                <MdClose size={19} />
              </button>
            </div>
          );
        })}
      </div>}
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
