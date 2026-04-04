import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdArrowForward,
  MdCheckCircle,
  MdChevronLeft,
  MdChevronRight,
  MdSchedule,
} from "react-icons/md";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { db } from "../firebase";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import {
  profileSavedCollectionPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SIDEBAR_PAGE_SIZE = 80;

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseReleaseDate = (releaseDate) => {
  if (!releaseDate) return null;
  const date = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatReleaseDateLabel = (releaseDate) => {
  const date = parseReleaseDate(releaseDate);
  if (!date) return releaseDate || "Date TBA";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getCountdownLabel = (releaseDate) => {
  const now = new Date();
  const release = parseReleaseDate(releaseDate);
  if (!release) return "Released";
  const diffMs = release.getTime() - now.getTime();
  if (diffMs <= 0) return "Released";

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
};

const isReleasedDate = (releaseDate) => {
  const release = parseReleaseDate(releaseDate);
  if (!release) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return release.getTime() <= today.getTime();
};

const getEffectiveShowReleaseDate = (item) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextEpisodeDate = parseReleaseDate(item.next_episode_to_air?.air_date);
  const lastEpisodeDate = parseReleaseDate(item.last_episode_to_air?.air_date);
  const seasonDate = Array.isArray(item.seasons)
    ? item.seasons
        .map((season) => parseReleaseDate(season?.air_date))
        .find(Boolean)
    : null;
  const originalDate = parseReleaseDate(item.releaseDate);

  if (nextEpisodeDate && nextEpisodeDate.getTime() >= today.getTime()) {
    return toDateKey(nextEpisodeDate);
  }

  if (lastEpisodeDate) return toDateKey(lastEpisodeDate);
  if (nextEpisodeDate) return toDateKey(nextEpisodeDate);
  if (seasonDate) return toDateKey(seasonDate);
  return originalDate ? toDateKey(originalDate) : item.releaseDate || null;
};

const normalizeReleaseItem = (item) => ({
  ...item,
  releaseDate:
    item.mediaType === "tv"
      ? getEffectiveShowReleaseDate(item)
      : item.releaseDate || null,
});

const compareReleaseStatus = (a, b) => {
  const aReleased = isReleasedDate(a.releaseDate);
  const bReleased = isReleasedDate(b.releaseDate);

  if (aReleased !== bReleased) {
    return aReleased ? 1 : -1;
  }

  return (
    parseReleaseDate(a.releaseDate)?.getTime() -
    parseReleaseDate(b.releaseDate)?.getTime()
  );
};

const getShowReleaseMeta = (item) => {
  if (item.mediaType !== "tv") return null;

  const candidateEpisodes = [
    item.next_episode_to_air,
    item.last_episode_to_air,
    item.episode_to_air,
  ].filter(Boolean);
  const matchedEpisode = candidateEpisodes.find(
    (episode) => episode?.air_date === item.releaseDate,
  );

  if (matchedEpisode) {
    const season = Number(matchedEpisode.season_number);
    const episode = Number(matchedEpisode.episode_number);
    if (season > 0 && episode > 0) return `S${season} E${episode}`;
  }

  const matchedSeason = Array.isArray(item.seasons)
    ? item.seasons.find(
        (season) =>
          Number(season?.season_number) > 0 &&
          season?.air_date === item.releaseDate,
      )
    : null;

  if (matchedSeason) {
    const season = Number(matchedSeason.season_number);
    const episodeCount = Number(matchedSeason.episode_count);
    if (season > 0 && episodeCount > 0) return `S${season} E1-${episodeCount}`;
    if (season > 0) return `S${season}`;
  }

  const season =
    Number(item.seasonNumber) ||
    Number(item.season_number) ||
    Number(item.next_episode_to_air?.season_number) ||
    Number(item.last_episode_to_air?.season_number);
  const episode =
    Number(item.episodeNumber) ||
    Number(item.episode_number) ||
    Number(item.next_episode_to_air?.episode_number) ||
    Number(item.last_episode_to_air?.episode_number);

  if (season > 0 && episode > 0) return `S${season} E${episode}`;
  if (season > 0) return `S${season}`;
  return null;
};

const getReleaseMetaLabel = (item) => {
  if (item.mediaType !== "tv") return "Movie";
  return getShowReleaseMeta(item) || "Series";
};

const PosterThumb = ({ posterPath, className = "w-10 h-14" }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!posterPath) {
    return <div className={`${className} rounded bg-white/10 shrink-0`} />;
  }

  return (
    <div
      className={`relative ${className} rounded shrink-0 overflow-hidden bg-white/10`}
    >
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/20 via-white/10 to-white/5" />
      )}
      {!failed && (
        <img
          src={`https://image.tmdb.org/t/p/w154${posterPath}`}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
};

const DayPosterGrid = ({ releases }) => {
  const count = releases.length;
  if (!count) return null;

  if (count === 1) {
    return (
      <PosterThumb
        posterPath={releases[0].poster}
        className="h-full w-full rounded-lg"
      />
    );
  }

  if (count === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-px rounded-lg bg-black/50">
        {releases.map((item) => (
          <PosterThumb
            key={`${item.mediaType}-${item.id}`}
            posterPath={item.poster}
            className="h-full w-full rounded-none"
          />
        ))}
      </div>
    );
  }

  const previewItems = releases.slice(0, 4);
  const overflow = count - previewItems.length;

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px rounded-lg bg-black/50">
      {previewItems.map((item, index) => (
        <div
          key={`${item.mediaType}-${item.id}-${index}`}
          className="relative h-full w-full overflow-hidden"
        >
          <PosterThumb
            posterPath={item.poster}
            className="h-full w-full rounded-none"
          />
          {overflow > 0 && index === previewItems.length - 1 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/65 text-[10px] font-semibold text-white">
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ReleaseCalendar = () => {
  const { user } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const navigate = useNavigate();
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [upcoming, setUpcoming] = useState([]);
  const [savedShows, setSavedShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingShows, setRefreshingShows] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [modalDate, setModalDate] = useState(null);
  const [monthDirection, setMonthDirection] = useState(0);
  const [countdownScope, setCountdownScope] = useState("current");
  const [visibleCount, setVisibleCount] = useState(SIDEBAR_PAGE_SIZE);
  const [fetchedFromYear, setFetchedFromYear] = useState(
    new Date().getFullYear(),
  );
  const activeProfileId = resolveProfileId(selectedProfile);

  useEffect(() => {
    if (profileLoading) return;
    if (!user?.email) {
      setUpcoming([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const currentYearStart = `${fetchedFromYear}-01-01`;
    const moviesRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showsRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "shows"),
    );
    const moviesQuery = query(
      moviesRef,
      where("releaseDate", ">=", currentYearStart),
      orderBy("releaseDate", "asc"),
    );
    const showsQuery = query(showsRef, orderBy("releaseDate", "asc"));

    let movies = [];
    let shows = [];
    let moviesLoaded = false;
    let showsLoaded = false;

    const sync = () => {
      if (!moviesLoaded || !showsLoaded) return;

      const merged = [...movies, ...shows]
        .map(normalizeReleaseItem)
        .filter((item) => item.releaseDate)
        .filter((item) => {
          const dt = parseReleaseDate(item.releaseDate);
          return Boolean(dt) && dt.getFullYear() >= fetchedFromYear;
        })
        .sort(compareReleaseStatus);

      const unique = Array.from(
        new Map(
          merged.map((item) => [
            `${item.mediaType || "movie"}:${item.id}:${item.releaseDate}`,
            item,
          ]),
        ).values(),
      );

      setUpcoming(unique);
      setLoading(false);
    };

    const unsubMovies = onSnapshot(
      moviesQuery,
      (snap) => {
        movies = snap.docs.map((d) => ({
          ...d.data(),
          id: d.data().id ?? Number(d.id),
          mediaType: "movie",
        }));
        moviesLoaded = true;
        sync();
      },
      () => {
        movies = [];
        moviesLoaded = true;
        sync();
      },
    );

    const unsubShows = onSnapshot(
      showsQuery,
      (snap) => {
        shows = snap.docs.map((d) => ({
          ...d.data(),
          id: d.data().id ?? Number(d.id),
          mediaType: "tv",
        }));
        setSavedShows(shows);
        showsLoaded = true;
        sync();
      },
      () => {
        shows = [];
        setSavedShows([]);
        showsLoaded = true;
        sync();
      },
    );

    return () => {
      unsubMovies();
      unsubShows();
    };
  }, [user?.email, activeProfileId, profileLoading, fetchedFromYear]);

  const releasesByDate = useMemo(() => {
    const map = new Map();
    upcoming.forEach((item) => {
      const key = item.releaseDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [upcoming]);

  const monthMatrix = useMemo(() => {
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const days = [];

    for (let i = 0; i < start.getDay(); i += 1) days.push(null);
    for (let d = 1; d <= end.getDate(); d += 1) {
      days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    while (days.length < 42) days.push(null);
    return days;
  }, [monthDate]);

  const selectedReleases = selectedDate
    ? releasesByDate.get(selectedDate) || []
    : [];
  const modalReleases = modalDate ? releasesByDate.get(modalDate) || [] : [];
  const monthReleases = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return upcoming.filter((item) => {
      const dt = parseReleaseDate(item.releaseDate);
      return dt && dt.getFullYear() === y && dt.getMonth() === m;
    });
  }, [upcoming, monthDate]);

  const monthReleaseDates = useMemo(
    () => new Set(monthReleases.map((item) => item.releaseDate)),
    [monthReleases],
  );

  const monthLabel = monthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const viewedYear = monthDate.getFullYear();
  const hasLimitedWindow = viewedYear < fetchedFromYear;

  const monthDayCount = monthReleaseDates.size;
  const countdownItems = useMemo(() => {
    if (countdownScope === "all") {
      return upcoming
        .filter((item) => {
          const dt = parseReleaseDate(item.releaseDate);
          return dt && dt.getFullYear() >= fetchedFromYear;
        })
        .sort(compareReleaseStatus);
    }

    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return upcoming
      .filter((item) => {
        const dt = parseReleaseDate(item.releaseDate);
        return dt && dt.getFullYear() === y && dt.getMonth() === m;
      })
      .sort(compareReleaseStatus);
  }, [upcoming, countdownScope, monthDate, fetchedFromYear]);
  const visibleCountdownItems = useMemo(
    () => countdownItems.slice(0, visibleCount),
    [countdownItems, visibleCount],
  );
  const canLoadMore = visibleCount < countdownItems.length;
  const visibleNotReleasedItems = useMemo(
    () =>
      visibleCountdownItems.filter((item) => !isReleasedDate(item.releaseDate)),
    [visibleCountdownItems],
  );
  const visibleReleasedItems = useMemo(
    () =>
      visibleCountdownItems.filter((item) => isReleasedDate(item.releaseDate)),
    [visibleCountdownItems],
  );
  const unreleasedCount = useMemo(
    () =>
      countdownItems.filter((item) => !isReleasedDate(item.releaseDate)).length,
    [countdownItems],
  );

  useEffect(() => {
    setVisibleCount(SIDEBAR_PAGE_SIZE);
  }, [countdownScope, monthDate, countdownItems.length]);

  const missingShowMetadataCount = useMemo(
    () =>
      savedShows.filter(
        (item) =>
          !item.next_episode_to_air &&
          !item.last_episode_to_air &&
          !(Array.isArray(item.seasons) && item.seasons.length > 0),
      ).length,
    [savedShows],
  );

  const refreshShowMetadata = async (mode = "missing") => {
    if (
      !user?.email ||
      !process.env.REACT_APP_TMDB_API_KEY ||
      refreshingShows
    ) {
      return;
    }

    const targetShows = savedShows.filter((item) => {
      if (mode === "all") return true;
      return (
        !item.next_episode_to_air &&
        !item.last_episode_to_air &&
        !(Array.isArray(item.seasons) && item.seasons.length > 0)
      );
    });

    if (!targetShows.length) {
      setRefreshMessage(
        mode === "all"
          ? "Already up to date."
          : "Nothing to refresh.",
      );
      return;
    }

    setRefreshingShows(true);
    setRefreshMessage("");

    let updatedCount = 0;

    try {
      for (const item of targetShows) {
        const response = await fetch(
          `https://api.themoviedb.org/3/tv/${item.id}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
        );
        if (!response.ok) continue;

        const data = await response.json();
        const showRef = doc(
          db,
          ...profileSavedCollectionPath(user.email, activeProfileId, "shows"),
          String(item.id),
        );

        await setDoc(
          showRef,
          {
            title: data.name || item.title || "",
            poster: data.poster_path ?? item.poster ?? null,
            backdrop: data.backdrop_path ?? item.backdrop ?? null,
            overview: data.overview ?? item.overview ?? null,
            releaseDate: data.first_air_date ?? item.releaseDate ?? null,
            rating: data.vote_average ?? item.rating ?? null,
            totalSeasons:
              Number.isFinite(Number(data.number_of_seasons)) &&
              Number(data.number_of_seasons) > 0
                ? Number(data.number_of_seasons)
                : item.totalSeasons || null,
            next_episode_to_air: data.next_episode_to_air ?? null,
            last_episode_to_air: data.last_episode_to_air ?? null,
            seasons: Array.isArray(data.seasons) ? data.seasons : [],
            metadataUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        updatedCount += 1;
      }

      setRefreshMessage(
        updatedCount > 0
          ? `${updatedCount} updated`
          : "No updates",
      );
    } finally {
      setRefreshingShows(false);
    }
  };

  const jumpToReleaseDate = (releaseDate) => {
    const dt = parseReleaseDate(releaseDate);
    if (!dt) return;
    setMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
    setSelectedDate(releaseDate);
    setMonthDirection(0);
  };

  const monthPanelVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 40 : dir < 0 ? -40 : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir) => ({
      x: dir > 0 ? -40 : dir < 0 ? 40 : 0,
      opacity: 0,
    }),
  };

  const renderStatusCard = (item) => {
    const released = isReleasedDate(item.releaseDate);
    const releaseMetaLabel = getReleaseMetaLabel(item);

    return (
      <div
        key={`${item.mediaType}-${item.id}`}
        className="w-full rounded-2xl border border-white/10 bg-[#111217] p-3 shadow-[0_8px_22px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start gap-3">
          <PosterThumb posterPath={item.poster} className="w-12 h-16" />

          <div className="min-w-0 flex-1">
            <button
              onClick={() =>
                navigate(
                  item.mediaType === "tv"
                    ? `/shows/${item.id}`
                    : `/movies/${item.id}`,
                )
              }
              className="text-sm sm:text-[15px] font-semibold leading-tight text-left hover:text-red-400 block w-full truncate"
            >
              {item.title || item.name}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-white/45">
              <span>{releaseMetaLabel}</span>
              <span className="text-white/25">•</span>
              <span>{formatReleaseDateLabel(item.releaseDate)}</span>
            </div>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              {released ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-200 inline-flex items-center gap-1.5 whitespace-nowrap">
                  <MdCheckCircle size={14} className="text-red-400" />
                  Released
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/90 inline-flex items-center gap-1.5 whitespace-nowrap">
                  <MdSchedule size={13} className="text-white/65" />
                  {getCountdownLabel(item.releaseDate)}
                </span>
              )}

              <button
                onClick={() => jumpToReleaseDate(item.releaseDate)}
                title="Jump to release date"
                className="h-8 sm:h-7 w-full sm:w-auto px-2.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-[11px] uppercase tracking-wide text-white/80 inline-flex items-center justify-center gap-1.5"
              >
                View
                <MdArrowForward size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white pt-28 pb-4 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-5 overflow-hidden">
            <div className="mb-2.5 space-y-2">
              <div className="grid grid-cols-[36px_1fr_36px] items-center gap-2">
                <button
                  onClick={() => {
                    setMonthDirection(-1);
                    setMonthDate(
                      new Date(
                        monthDate.getFullYear(),
                        monthDate.getMonth() - 1,
                        1,
                      ),
                    );
                  }}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <MdChevronLeft size={20} />
                </button>

                <h2 className="text-center text-lg md:text-xl font-semibold">
                  {monthLabel}
                </h2>

                <button
                  onClick={() => {
                    setMonthDirection(1);
                    setMonthDate(
                      new Date(
                        monthDate.getFullYear(),
                        monthDate.getMonth() + 1,
                        1,
                      ),
                    );
                  }}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <MdChevronRight size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 text-[11px] uppercase tracking-wide text-white/50">
                  TV gaps {missingShowMetadataCount}
                  {refreshMessage ? `  /  ${refreshMessage}` : ""}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => refreshShowMetadata("missing")}
                    disabled={refreshingShows || missingShowMetadataCount === 0}
                    className="h-7 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 text-[10px] uppercase tracking-wide text-white/80 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Refresh Missing
                  </button>
                  <button
                    type="button"
                    onClick={() => refreshShowMetadata("all")}
                    disabled={refreshingShows || savedShows.length === 0}
                    className="h-7 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 text-[10px] uppercase tracking-wide text-red-100 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Refresh All Shows
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait" custom={monthDirection}>
              <motion.div
                key={monthLabel}
                custom={monthDirection}
                variants={monthPanelVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">
                      This Month
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {monthReleases.length}
                    </p>
                    <p className="text-[11px] text-white/55">Upcoming titles</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">
                      Release Days
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {monthDayCount}
                    </p>
                    <p className="text-[11px] text-white/55">
                      Dates with drops
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">
                      Selected Day
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {selectedDate ? selectedReleases.length : 0}
                    </p>
                    <p className="text-[11px] text-white/55">Titles on date</p>
                  </div>
                </div>

                {hasLimitedWindow && (
                  <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs sm:text-sm text-amber-100/90">
                      Older releases are not loaded by default for performance.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFetchedFromYear(viewedYear)}
                      className="h-8 px-3 rounded-lg border border-amber-300/30 bg-amber-400/15 hover:bg-amber-400/25 text-[11px] sm:text-xs uppercase tracking-wide text-amber-100"
                    >
                      Load {viewedYear} and newer
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto pb-1">
                  <div className="min-w-[640px]">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {weekDays.map((d) => (
                        <div
                          key={d}
                          className="text-center text-xs uppercase tracking-widest text-white/40 py-2"
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2 pr-1">
                      {monthMatrix.map((day, idx) => {
                        if (!day) {
                          return (
                            <div
                              key={`blank-${idx}`}
                              className="h-20 rounded-lg bg-transparent"
                            />
                          );
                        }

                        const key = toDateKey(day);
                        const dayReleases = releasesByDate.get(key) || [];
                        const hasRelease = dayReleases.length > 0;
                        const isSelected = selectedDate === key;
                        const count = dayReleases.length;
                        const canOpenModal = count > 2;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedDate(key);
                              if (canOpenModal) setModalDate(key);
                            }}
                            className={`relative h-20 overflow-hidden rounded-lg border text-left transition ${
                              isSelected
                                ? "border-red-500 bg-red-500/15"
                                : hasRelease
                                  ? "border-red-500/35 bg-red-500/10 hover:bg-red-500/15"
                                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                            }`}
                          >
                            {hasRelease && (
                              <div className="absolute inset-0">
                                <DayPosterGrid releases={dayReleases} />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/75" />
                              </div>
                            )}

                            <div className="relative flex h-full flex-col justify-between p-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium">
                                  {day.getDate()}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6 overflow-hidden">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-sm uppercase tracking-widest text-white/40">
                Release Status
              </h3>
              <div className="grid grid-cols-2 rounded-xl border border-white/15 bg-black/40 p-1 w-full sm:w-[220px]">
                <button
                  type="button"
                  onClick={() => setCountdownScope("current")}
                  className={`px-3 py-1.5 text-[11px] rounded-lg transition ${
                    countdownScope === "current"
                      ? "bg-red-600 text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)]"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setCountdownScope("all")}
                  className={`px-3 py-1.5 text-[11px] rounded-lg transition ${
                    countdownScope === "all"
                      ? "bg-red-600 text-white shadow-[0_8px_24px_rgba(220,38,38,0.35)]"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {!user && (
              <p className="text-sm text-white/50">
                Sign in to load your saved titles.
              </p>
            )}
            {loading && user && (
              <p className="text-sm text-white/50">Loading releases...</p>
            )}
            {!loading && upcoming.length === 0 && (
              <p className="text-sm text-white/50">
                No titles with release dates found in your saved list.
              </p>
            )}

            {!loading && upcoming.length > 0 && countdownItems.length === 0 && (
              <p className="text-sm text-white/50">No titles in this month.</p>
            )}

            {!loading && countdownItems.length > 0 && (
              <div className="space-y-3 max-h-[58vh] lg:max-h-[640px] overflow-y-auto pr-5">
                {countdownScope === "all" ? (
                  <>
                    <div className="pt-1">
                      <p className="text-[11px] uppercase tracking-widest text-white/45 mb-2">
                        Not Released ({unreleasedCount})
                      </p>
                      <div className="space-y-3">
                        {visibleNotReleasedItems.length > 0 ? (
                          visibleNotReleasedItems.map(renderStatusCard)
                        ) : (
                          <p className="text-xs text-white/50">
                            No unreleased titles in this view.
                          </p>
                        )}
                      </div>
                    </div>

                    <hr className="border-white/10 my-1" />

                    <div className="pt-1">
                      <p className="text-[11px] uppercase tracking-widest text-white/45 mb-2">
                        Released
                      </p>
                      <div className="space-y-3">
                        {visibleReleasedItems.length > 0 ? (
                          visibleReleasedItems.map(renderStatusCard)
                        ) : (
                          <p className="text-xs text-white/50">
                            No released titles in this view.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {visibleNotReleasedItems.length > 0 && (
                      <div className="space-y-3">
                        {visibleNotReleasedItems.map(renderStatusCard)}
                      </div>
                    )}

                    {visibleReleasedItems.length > 0 && (
                      <>
                        {visibleNotReleasedItems.length > 0 && (
                          <hr className="border-white/10 my-1" />
                        )}
                        <div className="pt-1">
                          <div className="space-y-3">
                            {visibleReleasedItems.map(renderStatusCard)}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                {canLoadMore && (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((prev) => prev + SIDEBAR_PAGE_SIZE)
                    }
                    className="w-full h-10 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-sm text-white/85"
                  >
                    Load more ({countdownItems.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {refreshingShows && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101116] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-red-500" />
              <h3 className="text-xl font-semibold text-white">
                Refreshing Shows
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Pulling episode and season metadata for your saved shows. This
                might take a while.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalDate && modalReleases.length > 2 && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalDate(null)}
          >
            <motion.div
              className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0f1015] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                    Releases
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{modalDate}</h3>
                  <p className="mt-1 text-sm text-white/55">
                    {modalReleases.length} titles releasing that day
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModalDate(null)}
                  className="h-9 rounded-full border border-white/15 px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {modalReleases.map((item) => {
                  const releaseMetaLabel = getReleaseMetaLabel(item);

                  return (
                    <button
                      key={`${item.mediaType}-${item.id}`}
                      type="button"
                      onClick={() =>
                        navigate(
                          item.mediaType === "tv"
                            ? `/shows/${item.id}`
                            : `/movies/${item.id}`,
                        )
                      }
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]"
                    >
                      <PosterThumb
                        posterPath={item.poster}
                        className="h-20 w-14"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {item.title || item.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-white/45">
                          <span>{releaseMetaLabel}</span>
                          <span className="text-white/25">•</span>
                          <span>
                            {formatReleaseDateLabel(item.releaseDate)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReleaseCalendar;
