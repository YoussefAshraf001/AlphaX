import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdArrowForward,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import { collection, onSnapshot } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { db } from "../firebase";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import {
  profileSavedCollectionPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const activeProfileId = resolveProfileId(selectedProfile);

  useEffect(() => {
    if (profileLoading) return;
    if (!user?.email) {
      setUpcoming([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const moviesRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showsRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "shows"),
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
          return !Number.isNaN(dt.getTime()) && dt >= today;
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
      moviesRef,
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
      showsRef,
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
  }, [user?.email, activeProfileId, profileLoading]);

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

  const monthDayCount = monthReleaseDates.size;
  const countdownItems = useMemo(() => {
    if (countdownScope === "all") return upcoming;

    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return upcoming.filter((item) => {
      const dt = new Date(`${item.releaseDate}T00:00:00`);
      return dt.getFullYear() === y && dt.getMonth() === m;
    });
  }, [upcoming, countdownScope, monthDate]);

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

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0a] text-white pt-24 pb-4 px-4 md:px-8">
      <div className="max-w-7xl mx-auto h-full flex flex-col min-h-0">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Release Calendar
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Your unreleased saved movies with date markers and countdowns.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          <section className="lg:col-span-8 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6 overflow-hidden flex flex-col min-h-0">
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
                <div className="mb-4 grid grid-cols-3 gap-2">
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
              </motion.div>
            </AnimatePresence>

            {/* <div className="rounded-xl border border-white/10 bg-black/30 p-4 min-h-[180px] max-h-[220px] overflow-y-auto">
              <h3 className="text-sm font-semibold mb-2">
                {selectedDate
                  ? `Releases on ${selectedDate}`
                  : `${monthLabel} releases`}
              </h3>
              {!selectedDate && monthReleases.length === 0 && (
                <p className="text-sm text-white/60">
                  No unreleased saved titles in this month.
                </p>
              )}
              {!selectedDate && monthReleases.length > 0 && (
                <ul className="space-y-2">
                  {monthReleases.map((item) => (
                    <li
                      key={`${item.mediaType}-${item.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() =>
                            navigate(
                              item.mediaType === "tv"
                                ? `/shows/${item.id}`
                                : `/movies/${item.id}`,
                            )
                          }
                          className="text-sm hover:text-red-400 truncate text-left"
                        >
                          <span className="text-white/65 mr-2">
                            {formatReleaseDay(item.releaseDate)}
                          </span>
                          {item.title || item.name}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => jumpToReleaseDate(item.releaseDate)}
                          title="Jump to release date"
                          className="w-7 h-7 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        >
                          <MdEventAvailable size={15} />
                        </button>
                        <span className="text-xs text-white/60">
                          {getCountdownLabel(item.releaseDate)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {selectedDate && selectedReleases.length === 0 && (
                <p className="text-sm text-white/60">
                  No upcoming releases on this date.
                </p>
              )}
              {selectedDate && selectedReleases.length > 0 && (
                <ul className="space-y-2">
                  {selectedReleases.map((item) => (
                    <li
                      key={`${item.mediaType}-${item.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() =>
                            navigate(
                              item.mediaType === "tv"
                                ? `/shows/${item.id}`
                                : `/movies/${item.id}`,
                            )
                          }
                          className="text-sm hover:text-red-400 truncate text-left"
                        >
                          {item.title || item.name}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => jumpToReleaseDate(item.releaseDate)}
                          title="Jump to release date"
                          className="w-7 h-7 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center"
                        >
                          <MdEventAvailable size={15} />
                        </button>
                        <span className="text-xs text-white/60">
                          {getCountdownLabel(item.releaseDate)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div> */}
          </section>

          <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-black/40 p-4 md:p-6 overflow-hidden flex flex-col min-h-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm uppercase tracking-widest text-white/40">
                Unreleased Countdown
              </h3>
              <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => setCountdownScope("current")}
                  className={`px-3 py-1 text-[11px] rounded-full transition ${
                    countdownScope === "current"
                      ? "bg-red-600 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Current Month
                </button>
                <button
                  type="button"
                  onClick={() => setCountdownScope("all")}
                  className={`px-3 py-1 text-[11px] rounded-full transition ${
                    countdownScope === "all"
                      ? "bg-red-600 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {!user && (
              <p className="text-sm text-white/50">
                Sign in to load your saved unreleased titles.
              </p>
            )}
            {loading && user && (
              <p className="text-sm text-white/50">Loading releases...</p>
            )}
            {!loading && upcoming.length === 0 && (
              <p className="text-sm text-white/50">
                No unreleased titles found in your saved list.
              </p>
            )}

            {!loading && upcoming.length > 0 && countdownItems.length === 0 && (
              <p className="text-sm text-white/50">
                No unreleased titles in this month.
              </p>
            )}

            {!loading && countdownItems.length > 0 && (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {countdownItems.map((item) => (
                  <div
                    key={`${item.mediaType}-${item.id}`}
                    className="h-[72px] w-full flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-2"
                  >
                    {item.poster ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w154${item.poster}`}
                        alt={item.title || item.name}
                        className="w-10 h-14 object-cover rounded shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-white/10 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() =>
                          navigate(
                            item.mediaType === "tv"
                              ? `/shows/${item.id}`
                              : `/movies/${item.id}`,
                          )
                        }
                        className="text-sm font-medium truncate leading-tight text-left hover:text-red-400 block w-full"
                      >
                        {item.title || item.name}
                      </button>
                      <p className="text-xs text-white/60 truncate">
                        {item.mediaType === "tv" ? "TV" : "Movie"} •{" "}
                        {item.releaseDate}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => jumpToReleaseDate(item.releaseDate)}
                        title="Jump to release date"
                        className="w-7 h-7 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center"
                      >
                        <MdArrowForward />
                      </button>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 border border-red-400/30">
                        {getCountdownLabel(item.releaseDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ReleaseCalendar;
