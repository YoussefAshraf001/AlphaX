import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaPlay, FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import { motion, useReducedMotion } from "framer-motion";
import usePlaybackProgress from "./usePlaybackProgress";
import { normalizePlayerEvent } from "../../utils/playbackProgress";

export default function WatchDetails({
  media,
  type,
  children,
  email,
  profileId = "main",
}) {
  const {
    saved,
    ready,
    error: syncError,
    record,
    flush,
  } = usePlaybackProgress({ media, type, email, profileId });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeRequested = searchParams.get("resume") === "1";
  const autoResumed = useRef(false);
  const [resumeRestored, setResumeRestored] = useState(false);
  const [episodeSelectionReady, setEpisodeSelectionReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState(() => (resumeRequested ? "watch" : "details"));
  const seasons = (media.seasons || []).filter(
    (item) => item.episode_count > 0,
  );
  const [season, setSeason] = useState(
    () =>
      seasons.find((item) => item.season_number > 0)?.season_number ??
      seasons[0]?.season_number ??
      1,
  );
  const [episode, setEpisode] = useState(1);
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playerUrl, setPlayerUrl] = useState("");
  const restored = useRef(false);
  const advanced = useRef(false);
  const frame = useRef(null);
  const positions = useRef({});
  const route =
    type === "tv"
      ? `/tv/${media.id}/${season}/${episode}`
      : `/movie/${media.id}`;
  const title = media.title || media.name;
  const date = media.release_date || media.first_air_date;
  const unreleased = date && new Date(`${date}T00:00:00`) > new Date();
  const [episodeData, setEpisodeData] = useState({
    season: null,
    items: [],
    error: false,
  });
  const [retry, setRetry] = useState(0);
  // const episodes = episodeData.season === season ? episodeData.items : [];
  const episodes = episodeData.items;
  const episodesLoading = type === "tv" && episodeData.season !== season;
  const canPlay =
    ready &&
    !unreleased &&
    (type !== "tv" || episodes.some((item) => item.episode_number === episode));
  const progressKey = type === "tv" ? `s${season}e${episode}` : "movie";
  const currentProgress = saved?.episodeProgress?.[progressKey];

  useEffect(() => {
    if (
      !ready ||
      !resumeRestored ||
      type !== "tv" ||
      episodeData.season !== season ||
      advanced.current
    )
      return;
    if (saved?.playback && saved.playback.season !== season) return;
    advanced.current = true;
    setEpisodeSelectionReady(true);
    if (saved?.playback?.completed && saved.playback.season === season) {
      const next = episodeData.items.find(
        (item) => item.episode_number > saved.playback.episode,
      );
      if (next) setEpisode(next.episode_number);
    }
  }, [ready, resumeRestored, type, season, episodeData, saved]);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    setResumeRestored(true);
    if (type === "tv" && saved?.playback?.episode > 0) {
      setSeason(saved.playback.season);
      setEpisode(saved.playback.episode);
    }
  }, [ready, saved, type]);

  const startPlayer = useCallback(() => {
    const position = currentProgress?.completed
      ? 0
      : (positions.current[route] ?? currentProgress?.currentTime ?? 0);
    setPlayerUrl(
      `https://www.vidy.st${route}?color=E50914&progress=${Math.floor(position)}`,
    );
    setStarted(true);
  }, [currentProgress, route]);

  useEffect(() => {
    if (
      !resumeRequested ||
      autoResumed.current ||
      !resumeRestored ||
      !canPlay ||
      (type === "tv" && !episodeSelectionReady)
    )
      return;
    autoResumed.current = true;
    setTab("watch");
    startPlayer();
  }, [
    resumeRequested,
    resumeRestored,
    canPlay,
    type,
    episodeSelectionReady,
    startPlayer,
  ]);

  function playEpisode(number) {
    resetPlayer();
    setEpisode(number);
    const episodeRoute = `/tv/${media.id}/${season}/${number}`;
    const progress = saved?.episodeProgress?.[`s${season}e${number}`];
    const position = progress?.completed
      ? 0
      : (positions.current[episodeRoute] ?? progress?.currentTime ?? 0);
    setPlayerUrl(
      `https://www.vidy.st${episodeRoute}?color=E50914&progress=${Math.floor(position)}`,
    );
    setStarted(true);
    // window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (type !== "tv") return;
    let cancelled = false;
    // setEpisodeData({ season: null, items: [], error: false });
    setEpisodeData((current) => ({
      ...current,
      error: false,
    }));
    axios
      .get(`https://api.themoviedb.org/3/tv/${media.id}/season/${season}`, {
        params: { api_key: process.env.REACT_APP_TMDB_API_KEY },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const items = (data.episodes || []).filter(
          (item) => item.air_date && item.air_date <= today,
        );
        setEpisodeData({ season, items, error: false });
        setEpisode((current) =>
          items.some((item) => item.episode_number === current)
            ? current
            : items[0]?.episode_number || 1,
        );
      })
      .catch(() => {
        if (!cancelled) setEpisodeData({ season, items: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [media.id, type, season, retry]);

  useEffect(() => {
    function receive(event) {
      if (
        event.source !== frame.current?.contentWindow ||
        !["https://vidy.st", "https://www.vidy.st"].includes(event.origin)
      )
        return;
      try {
        const data = normalizePlayerEvent(event.data, {
          id: media.id,
          type,
          season,
          episode,
        });
        if (data) {
          const playingRoute =
            type === "tv"
              ? `/tv/${media.id}/${data.season}/${data.episode}`
              : route;
          positions.current[playingRoute] =
            data.event === "ended" ? 0 : data.currentTime;
          if (type === "tv") {
            setSeason(data.season);
            setEpisode(data.episode);
          }
          record(data);
        }
      } catch {
        /* Ignore unrelated player messages. */
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [route, record, season, episode, type, media.id]);

  useEffect(() => {
    if (!started || loaded || tab !== "watch") return;
    const timer = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(timer);
  }, [started, loaded, tab]);

  function resetPlayer() {
    flush();
    setStarted(false);
    setLoaded(false);
    setFailed(false);
  }

  function selectTab(value) {
    if (tab === value) return;
    resetPlayer();
    setTab(value);
  }

  return (
    <div className={`relative -mt-2 -mx-4 md:-mx-8 -mb-12 min-h-[calc(100vh-5.5rem)] overflow-hidden bg-[#090909] tracking-normal [&_p]:break-words [&_span]:break-words ${tab === "watch" ? "border-y border-white/10 px-4 pt-5 pb-16 md:px-[4vw]" : "pt-0 pb-16"}`}>
      <div className={`relative z-20 max-w-[1400px] mx-auto mb-5 items-center justify-between gap-4 ${tab === "watch" ? "flex" : "hidden"}`}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 text-sm font-medium text-white/80 shadow-lg backdrop-blur-xl transition hover:bg-white/15 hover:text-white"
        >
          <FaArrowLeft /> Back
        </button>
        <div
          role="tablist"
          aria-label="Title view"
          className="relative grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/55 p-1 shadow-xl backdrop-blur-xl [&>button]:relative [&>button]:z-[1] [&>button]:!bg-transparent [&>button]:!rounded-full [&>button]:!text-[13px] [&>button]:!px-5 [&>button]:!py-[9px] [&>button]:min-w-[96px] [&>button[aria-selected=true]]:!text-white"
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-full bg-white/20 shadow-inner transition-transform duration-300 motion-reduce:transition-none ${tab === "details" ? "translate-x-[calc(100%+4px)]" : ""}`}
          />
          {["watch", "details"].map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`${value}-tab`}
              aria-selected={tab === value}
              aria-controls={`${value}-panel`}
              tabIndex={tab === value ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "watch"
                      : event.key === "End"
                        ? "details"
                        : tab === "watch"
                          ? "details"
                          : "watch";
                  selectTab(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }
              }}
              onClick={() => selectTab(value)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold capitalize transition ${tab === value ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
      >
        {tab === "watch" ? (
          <section
            id="watch-panel"
            role="tabpanel"
            aria-labelledby="watch-tab"
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] [grid-template-areas:'screen'_'status'_'toolbar'_'summary'_'selectors'_'episodes'] lg:[grid-template-areas:'screen_summary'_'status_summary'_'toolbar_summary'_'selectors_selectors'_'episodes_episodes'] gap-x-8 items-start max-w-[1400px] mx-auto"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-[#050505] shadow-xl [grid-area:screen] [&_img]:!opacity-[0.85]">
              {!started ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  {media.backdrop_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/original${media.backdrop_path}`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-40"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/20" />
                  <span className="absolute top-3 left-3 sm:top-[22px] sm:left-6 text-[8px] sm:text-[9px] font-bold text-white/60 px-1.5 py-1 sm:px-2.5 sm:py-[7px] bg-black/30 border border-white/20 rounded">
                    {type === "tv"
                      ? `SEASON ${season} / EPISODE ${episode}`
                      : "FEATURE PRESENTATION"}
                  </span>
                  {!canPlay ? (
                    <p
                      role="status"
                      className="relative px-6 text-center text-sm text-white/80"
                    >
                      {!ready
                        ? "Loading your progress…"
                        : unreleased
                          ? "This title has not been released yet"
                          : episodesLoading
                            ? "Finding released episodes…"
                            : episodeData.error
                              ? "Episode information is unavailable. Retry below."
                              : "No released episodes in this season yet"}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={startPlayer}
                      className="relative flex items-center gap-3 rounded-lg bg-white text-zinc-900 px-4 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-[15px] font-semibold shadow-[0_0_0_7px_#ffffff0b] hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      <FaPlay />{" "}
                      {currentProgress?.currentTime > 0 &&
                      !currentProgress.completed
                        ? "Resume"
                        : "Watch now"}
                    </button>
                  )}
                  <div className="absolute left-3.5 right-3.5 bottom-3 sm:left-6 sm:right-6 sm:bottom-6 pointer-events-none flex flex-col gap-1.5 [&>span]:text-base sm:[&>span]:text-[28px] [&>span]:font-bold [&>small]:text-white/50 [&>small]:text-xs max-sm:[&>small]:hidden">
                    <span>
                      {type === "tv"
                        ? episodes.find(
                            (item) => item.episode_number === episode,
                          )?.name || `Episode ${episode}`
                        : title}
                    </span>
                    <small>
                      {type === "tv" ? title : "Ready when you are"}
                    </small>
                  </div>
                </div>
              ) : (
                <>
                  {!loaded && (
                    <div
                      role="status"
                      className="absolute inset-0 flex items-center justify-center text-white/60"
                    >
                      {failed
                        ? "The player is taking longer than expected. Try reloading below."
                        : "Loading player…"}
                    </div>
                  )}
                  <iframe
                    ref={frame}
                    src={playerUrl}
                    title={`${title}${type === "tv" ? ` — Season ${season}, Episode ${episode}` : ""} player`}
                    className={`absolute inset-0 h-full w-full border-0 ${loaded ? "opacity-100" : "opacity-0"}`}
                    allow="encrypted-media; autoplay *; fullscreen *"
                    allowFullScreen
                    onLoad={() => {
                      setLoaded(true);
                      setFailed(false);
                    }}
                    onError={() => setFailed(true)}
                  />
                </>
              )}
            </div>
            <div
              className="[grid-area:status] flex flex-wrap gap-3 mt-4 text-[11px] leading-relaxed text-zinc-400 [&>span]:text-zinc-300"
              role="status"
            >
              {syncError ||
                (!email
                  ? "Sign in to save your watch progress."
                  : !ready
                    ? "Loading watch progress…"
                    : "Progress saves automatically to your profile.")}
              {currentProgress?.currentTime > 0 && (
                <span>
                  {" "}
                  {Math.floor(currentProgress.currentTime / 60)} min watched
                  {currentProgress.duration > 0
                    ? ` · ${Math.max(0, Math.ceil((currentProgress.duration - currentProgress.currentTime) / 60))} min left`
                    : ""}
                </span>
              )}
            </div>
            <div className="[grid-area:toolbar] mt-3 flex flex-wrap items-center justify-between gap-4 [&>span]:!text-[10px] [&>span]:!text-zinc-400 [&>button]:!text-[11px]">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
                {type === "tv"
                  ? `Series / Season ${season} / Episode ${episode}`
                  : "Movie"}
              </span>
              {started && (
                <button
                  type="button"
                  onClick={resetPlayer}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Having trouble? Reload player
                </button>
              )}
            </div>
            {type === "tv" && (
              <div className="[grid-area:selectors] mt-9 flex flex-wrap gap-4 py-5 border-b border-white/10 [&_label]:flex-1 [&_label]:min-w-0 max-sm:[&_label]:basis-full [&_select]:max-w-full [&_select]:!rounded-md [&_select]:!bg-[#141414] [&_select]:!border-white/20">
                <label className="flex flex-col gap-2 text-xs text-white/60">
                  Season
                  <select
                    value={season}
                    onChange={(event) => {
                      resetPlayer();
                      setSeason(Number(event.target.value));
                      setEpisode(1);
                    }}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm text-white"
                  >
                    {(seasons.length
                      ? seasons
                      : [{ season_number: 1, name: "Season 1" }]
                    ).map((item) => (
                      <option
                        key={item.season_number}
                        value={item.season_number}
                      >
                        {item.name || `Season ${item.season_number}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs text-white/60">
                  Episode
                  <select
                    disabled={!episodes.length || episodesLoading}
                    value={episodes.length ? episode : ""}
                    onChange={(event) => {
                      resetPlayer();
                      setEpisode(Number(event.target.value));
                    }}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-3 text-sm text-white"
                  >
                    {!episodes.length && (
                      <option value="">
                        {episodesLoading
                          ? "Loading episodes…"
                          : "No episodes available"}
                      </option>
                    )}
                    {episodes.map((item) => (
                      <option
                        key={item.episode_number}
                        value={item.episode_number}
                      >
                        Episode {item.episode_number}
                        {item.name ? ` — ${item.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="self-end pb-3 text-xs text-white/50">
                  {episodeData.error ? (
                    <button
                      type="button"
                      onClick={() => setRetry((value) => value + 1)}
                      className="text-red-300 hover:text-white"
                    >
                      Retry episode information
                    </button>
                  ) : (
                    !episodesLoading &&
                    `${episodes.length} released episode${episodes.length === 1 ? "" : "s"}`
                  )}
                </div>
              </div>
            )}
            {type === "tv" && episodes.length > 0 && (
              <div className="[grid-area:episodes] mt-8">
                <div className="flex justify-between items-baseline mb-3">
                  <h2 className="text-[22px] font-bold">Episodes</h2>

                  <span className="text-zinc-400 text-sm">
                    {seasons.find((item) => item.season_number === season)
                      ?.name || `Season ${season}`}
                  </span>
                </div>

                <div className="divide-y divide-white/10 border-t border-white/10">
                  {episodes.map((item) => {
                    const progress =
                      saved?.episodeProgress?.[
                        `s${season}e${item.episode_number}`
                      ];

                    const percent = progress?.completed
                      ? 100
                      : progress?.duration > 0
                        ? Math.min(
                            100,
                            (progress.currentTime / progress.duration) * 100,
                          )
                        : 0;

                    const isSelected = episode === item.episode_number;

                    return (
                      <article
                        key={item.episode_number}
                        className={`
                          group flex flex-col sm:grid
                          sm:grid-cols-[34px_210px_minmax(0,1fr)]
                          gap-4
                          py-5 px-3
                          transition
                          hover:bg-white/[0.04]
                          ${isSelected ? "bg-white/[0.06]" : ""}
                        `}
                      >
                        <div className="hidden sm:flex items-center justify-center text-xl text-zinc-500">
                          {item.episode_number}
                        </div>

                        <button
                          type="button"
                          // disabled={!ready}
                          disabled={!ready || episodesLoading}
                          onClick={() => playEpisode(item.episode_number)}
                          aria-label={`Watch episode ${item.episode_number}`}
                          className="
                            relative
                            w-full
                            aspect-video
                            overflow-hidden
                            rounded-md
                            bg-zinc-800
                          "
                        >
                          {item.still_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w300${item.still_path}`}
                              alt=""
                              loading="lazy"
                              className="
                                w-full h-full object-cover
                                transition-transform duration-300
                                group-hover:scale-[1.025]
                              "
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-800" />
                          )}

                          <div
                            className="
                              absolute inset-0
                              flex items-center justify-center
                              opacity-0 group-hover:opacity-100
                              transition
                              bg-black/15
                            "
                          >
                            <FaPlay className="w-11 h-11 p-[13px] rounded-full bg-black/70 border border-white/60 text-white" />
                          </div>

                          {percent > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                              <div
                                className="h-full bg-red-600"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          )}
                        </button>

                        <div className="min-w-0 flex flex-col justify-center">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-semibold text-[15px] text-white">
                              <span className="sm:hidden text-zinc-400 mr-2">
                                {item.episode_number}.
                              </span>

                              {item.name || `Episode ${item.episode_number}`}
                            </h3>

                            {item.runtime && (
                              <span className="shrink-0 text-xs text-zinc-400">
                                {item.runtime}m
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400 line-clamp-3">
                            {item.overview || "No synopsis available."}
                          </p>

                          <div className="mt-3 flex items-center gap-3">
                            {progress?.completed ? (
                              <span className="text-xs text-zinc-300">
                                ✓ Watched
                              </span>
                            ) : progress?.currentTime > 0 ? (
                              <span className="text-xs text-zinc-400">
                                {Math.floor(progress.currentTime / 60)} min
                                watched
                              </span>
                            ) : null}

                            <button
                              type="button"
                              disabled={!email || !ready}
                              onClick={() => {
                                record({
                                  event: "pause",
                                  manual: true,
                                  completed: !progress?.completed,
                                  currentTime: progress?.currentTime || 0,
                                  duration: progress?.duration || 0,
                                  season,
                                  episode: item.episode_number,
                                });
                              }}
                              className="
                                text-[11px]
                                text-zinc-400
                                hover:text-white
                                transition
                                disabled:opacity-40
                              "
                            >
                              {progress?.completed
                                ? "Mark unwatched"
                                : "Mark watched"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="[grid-area:summary] min-w-0 pt-7 lg:pt-[22px] lg:pl-6 lg:pb-6 lg:border-l lg:border-white/10 lg:self-stretch [&>h1]:!text-[28px] lg:[&>h1]:!text-[32px] [&>h1]:font-extrabold [&>h1]:!leading-tight [&>p]:!text-[13px] [&>p]:!leading-relaxed lg:[&>p]:line-clamp-5 [&>button]:border [&>button]:border-white/15 [&>button]:bg-white/5 [&>button]:px-4 [&>button]:py-2.5 [&>button]:rounded-md [&>button]:!text-xs lg:[&>button]:w-full [&>button:hover]:bg-white/10">
              <span className="text-[9px] font-bold text-rose-400 block mb-4">
                {type === "tv" ? "THE SERIES" : "THE MOVIE"}
              </span>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 text-sm text-white/50">
                {[
                  date?.slice(0, 4),
                  ...(media.genres || []).map((genre) => genre.name),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white/70 md:text-base">
                {media.overview || "No synopsis available yet."}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/10 max-lg:max-w-[360px] [&_span]:block [&_span]:text-zinc-400 [&_span]:text-[10px] [&_span]:mb-1 [&_strong]:text-[13px] [&_strong]:font-medium">
                <div>
                  <span>{type === "tv" ? "Seasons" : "Runtime"}</span>
                  <strong>
                    {type === "tv"
                      ? seasons.length
                      : media.runtime
                        ? `${media.runtime} min`
                        : "Not listed"}
                  </strong>
                </div>
                <div>
                  <span>Audience score</span>
                  <strong>
                    {media.vote_average > 0
                      ? `${media.vote_average.toFixed(1)} / 10`
                      : "Not rated"}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectTab("details")}
                className="mt-5 text-sm font-semibold text-white/80 hover:text-white"
              >
                Explore details & cast →
              </button>
            </div>
          </section>
        ) : (
          <section
            id="details-panel"
            role="tabpanel"
            aria-labelledby="details-tab"
          >
            <div className="hidden">
              {media.backdrop_path && (
                <img
                  src={`https://image.tmdb.org/t/p/original${media.backdrop_path}`}
                  alt=""
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,#090909_0%,rgba(9,9,9,0.72)_15%,transparent_52%),linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.56)_42%,transparent_76%),linear-gradient(180deg,rgba(0,0,0,0.55)_0%,transparent_28%)]" />
              <div className="absolute bottom-16 left-4 w-[680px] max-w-[calc(100%-32px)] md:bottom-24 md:left-[max(4vw,calc((100%_-_1400px)/2))] [&>h1]:mb-4 [&>h1]:mt-3 [&>h1]:max-w-[650px] [&>h1]:text-4xl [&>h1]:font-black [&>h1]:leading-[0.98] [&>h1]:drop-shadow-2xl md:[&>h1]:text-6xl lg:[&>h1]:text-7xl [&>button]:inline-flex [&>button]:items-center [&>button]:gap-3 [&>button]:rounded-md [&>button]:bg-white [&>button]:px-7 [&>button]:py-3 [&>button]:text-base [&>button]:font-bold [&>button]:text-black [&>button]:shadow-xl [&>button]:transition [&>button:hover]:bg-white/80">
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">
                  <span className="text-red-500">SceneariX</span>
                  <span>{type === "tv" ? "Series" : "Film"}</span>
                </div>
                <h1>{title}</h1>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
                  {media.vote_average > 0 && (
                    <span className="text-emerald-400">
                      {Math.round(media.vote_average * 10)}% Match
                    </span>
                  )}
                  <span>{date?.slice(0, 4)}</span>
                  {type === "tv" && seasons.length > 0 && (
                    <span>
                      {seasons.length} season{seasons.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {type !== "tv" && media.runtime > 0 && (
                    <span>{media.runtime} min</span>
                  )}
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-white/80 line-clamp-3 md:text-base">
                  {media.overview ||
                    "Discover the story, cast, and everything you need to know about this title."}
                </p>
                <p className="mt-3 text-xs text-white/60">
                  {[
                    date?.slice(0, 4),
                    type === "tv"
                      ? `${seasons.length} seasons`
                      : media.runtime
                        ? `${media.runtime} min`
                        : "",
                    ...(media.genres || [])
                      .slice(0, 2)
                      .map((genre) => genre.name),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <button type="button" onClick={() => selectTab("watch")}>
                  <FaPlay />{" "}
                  {currentProgress?.currentTime > 0 &&
                  !currentProgress?.completed
                    ? "Resume watching"
                    : "Watch"}
                </button>
              </div>
            </div>
            <div className="relative z-10">
              {children}
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}
