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
  onSnapshot,
  orderBy,
  query,
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

const getCountdownLabel = (releaseDate) => {
  const now = new Date();
  const release = new Date(`${releaseDate}T00:00:00`);
  const diffMs = release.getTime() - now.getTime();
  if (diffMs <= 0) return "Released";

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
};

const isReleasedDate = (releaseDate) => {
  const release = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(release.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return release.getTime() <= today.getTime();
};

const compareReleaseStatus = (a, b) => {
  const aReleased = isReleasedDate(a.releaseDate);
  const bReleased = isReleasedDate(b.releaseDate);

  if (aReleased !== bReleased) {
    return aReleased ? 1 : -1;
  }

  return (
    new Date(`${a.releaseDate}T00:00:00`).getTime() -
    new Date(`${b.releaseDate}T00:00:00`).getTime()
  );
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

const ReleaseCalendar = () => {
  const { user } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const navigate = useNavigate();
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
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
    const showsQuery = query(
      showsRef,
      where("releaseDate", ">=", currentYearStart),
      orderBy("releaseDate", "asc"),
    );

    let movies = [];
    let shows = [];
    let moviesLoaded = false;
    let showsLoaded = false;

    const sync = () => {
      if (!moviesLoaded || !showsLoaded) return;

      const merged = [...movies, ...shows]
        .filter((i) => i.releaseDate)
        .filter((i) => {
          const dt = new Date(`${i.releaseDate}T00:00:00`);
          return !Number.isNaN(dt.getTime());
        })
        .sort(
          (a, b) =>
            new Date(`${a.releaseDate}T00:00:00`).getTime() -
            new Date(`${b.releaseDate}T00:00:00`).getTime(),
        );

      const unique = Array.from(
        new Map(
          merged.map((i) => [`${i.mediaType || "movie"}:${i.id}`, i]),
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
        showsLoaded = true;
        sync();
      },
      () => {
        shows = [];
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
  const monthReleases = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return upcoming.filter((item) => {
      const dt = new Date(`${item.releaseDate}T00:00:00`);
      return dt.getFullYear() === y && dt.getMonth() === m;
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
          const dt = new Date(`${item.releaseDate}T00:00:00`);
          return dt.getFullYear() >= fetchedFromYear;
        })
        .sort(compareReleaseStatus);
    }

    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return upcoming
      .filter((item) => {
        const dt = new Date(`${item.releaseDate}T00:00:00`);
        return dt.getFullYear() === y && dt.getMonth() === m;
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

  const jumpToReleaseDate = (releaseDate) => {
    const dt = new Date(`${releaseDate}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return;
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
            <p className="mt-1 text-[11px] uppercase tracking-wide text-white/45">
              {item.mediaType === "tv" ? "Series" : "Movie"} •{" "}
              {item.releaseDate}
            </p>

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
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white pt-32 pb-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col">
        {/* <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Release Calendar
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Your saved release schedule with date markers and status.
          </p>
        </div> */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
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

              <h2 className="text-lg md:text-xl font-semibold">{monthLabel}</h2>

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
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">
                      This Month
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {monthReleases.length}
                    </p>
                    <p className="text-[11px] text-white/55">Upcoming titles</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
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
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
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
                        const hasRelease = releasesByDate.has(key);
                        const isSelected = selectedDate === key;
                        const count = releasesByDate.get(key)?.length || 0;

                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedDate(key)}
                            className={`h-20 rounded-lg border text-left p-2 transition ${
                              isSelected
                                ? "border-red-500 bg-red-500/15"
                                : hasRelease
                                  ? "border-red-500/35 bg-red-500/10 hover:bg-red-500/15"
                                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="text-sm font-medium">
                              {day.getDate()}
                            </div>
                            {hasRelease && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
                                <span className="text-[10px] text-white/70">
                                  {count} release{count > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
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
    </div>
  );
};

export default ReleaseCalendar;
