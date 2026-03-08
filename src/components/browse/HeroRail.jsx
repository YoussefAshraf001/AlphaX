import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import YouTube from "react-youtube";
import {
  MdFullscreen,
  MdPause,
  MdPlayArrow,
  MdVolumeOff,
  MdVolumeUp,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";

import StatusButtons from "../actions/StatusButtons";
import { GENRE_MAP } from "../../constants/genres";
import imdbLogo from "../../assets/logos/imdb.svg";

const HERO_WIDTH = "max-w-[1580px]";
const ADVANCE_DELAY_FALLBACK = 6000;
const TRAILER_DURATION_FALLBACK = 90000;

const HeroSkeleton = () => (
  <div className="absolute inset-0 bg-neutral-900 animate-pulse">
    <div className="absolute left-4 md:left-8 lg:left-12 bottom-8 md:bottom-12 lg:bottom-20 space-y-3 md:space-y-4 max-w-[82%]">
      <div className="h-3 w-20 md:w-24 bg-neutral-700 rounded" />
      <div className="h-9 md:h-12 w-[220px] sm:w-[340px] md:w-[420px] bg-neutral-700 rounded" />
      <div className="h-3 md:h-4 w-[180px] sm:w-[260px] md:w-[320px] bg-neutral-700 rounded" />
      <div className="h-9 md:h-10 w-[180px] sm:w-[220px] md:w-[260px] bg-neutral-700 rounded mt-4 md:mt-6" />
    </div>
  </div>
);

const HeroRail = ({ poolEndpoint }) => {
  const navigate = useNavigate();
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [poolLoading, setPoolLoading] = useState(true);
  const [trailerKey, setTrailerKey] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const advanceTimer = useRef(null);
  const heroRef = useRef(null);
  const playerRef = useRef(null);
  const current = pool[index];
  const currentId = current?.id;
  const currentMediaType = current?.media_type;

  const next = useCallback(() => {
    if (!pool.length) return;
    setIndex((i) => (i + 1) % pool.length);
  }, [pool.length]);

  const fallbackAdvance = useCallback(() => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(next, ADVANCE_DELAY_FALLBACK);
  }, [next]);

  useEffect(() => {
    if (!poolEndpoint) return;

    setPool([]);
    setIndex(0);
    setPoolLoading(true);

    axios
      .get(poolEndpoint)
      .then((res) => {
        setPool(res.data.results || []);
      })
      .finally(() => {
        setPoolLoading(false);
      });
  }, [poolEndpoint]);

  useEffect(() => {
    if (!currentId) return;

    clearTimeout(advanceTimer.current);
    setTrailerKey(null);
    setVideoReady(false);
    setImageLoaded(false);
    setIsMuted(true);
    setIsPlaying(true);

    const fetchTrailer = async () => {
      try {
        const type = currentMediaType === "tv" ? "tv" : "movie";
        const res = await axios.get(
          `https://api.themoviedb.org/3/${type}/${currentId}/videos`,
          { params: { api_key: process.env.REACT_APP_TMDB_API_KEY } },
        );

        const trailer = (res.data.results || []).find(
          (v) => v.site === "YouTube" && v.type === "Trailer",
        );

        if (trailer?.key) {
          setTrailerKey(trailer.key);
          advanceTimer.current = setTimeout(next, TRAILER_DURATION_FALLBACK);
        } else {
          fallbackAdvance();
        }
      } catch {
        fallbackAdvance();
      }
    };

    fetchTrailer();
    return () => clearTimeout(advanceTimer.current);
  }, [currentId, currentMediaType, fallbackAdvance, next]);

  const handleVideoState = (e) => {
    if (e.data === 1) {
      setVideoReady(true);
      setIsPlaying(true);
    }
    if (e.data === 2) setIsPlaying(false);
    if (e.data === 0) setIsPlaying(false);
  };

  const handleVideoReady = (e) => {
    playerRef.current = e.target;
    setIsMuted(Boolean(e.target.isMuted?.()));
  };

  const toggleMute = () => {
    if (!playerRef.current || !trailerKey) return;
    if (isMuted) {
      playerRef.current.unMute?.();
      setIsMuted(false);
      return;
    }
    playerRef.current.mute?.();
    setIsMuted(true);
  };

  const togglePlay = () => {
    if (!playerRef.current || !trailerKey) return;
    if (isPlaying) {
      playerRef.current.pauseVideo?.();
      setIsPlaying(false);
      clearTimeout(advanceTimer.current);
      return;
    }
    playerRef.current.playVideo?.();
    setIsPlaying(true);
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(next, TRAILER_DURATION_FALLBACK);
  };

  const toggleFullscreen = async () => {
    const el = heroRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await el.requestFullscreen();
  };

  if (poolLoading || !current) {
    return (
      <section className="w-full bg-black py-4 md:py-6 lg:py-8">
        <div
          className={`relative mx-auto ${HERO_WIDTH} h-[420px] md:h-[500px] xl:h-[560px] overflow-hidden rounded-2xl`}
        >
          <HeroSkeleton />
        </div>
      </section>
    );
  }

  const rightRail = Array.from({ length: 3 }, (_, i) => {
    const idx = (index + i + 1) % pool.length;
    return { item: pool[idx], idx };
  });

  return (
    <section className="w-full bg-black py-4 md:py-6 lg:py-8">
      <div
        ref={heroRef}
        className={`relative mx-auto ${HERO_WIDTH} h-[420px] md:h-[500px] xl:h-[560px] overflow-hidden rounded-2xl`}
      >
        {current.backdrop_path ? (
          <img
            src={`https://image.tmdb.org/t/p/original/${current.backdrop_path}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            alt=""
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-800" />
        )}

        {trailerKey && (
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
              videoReady && isPlaying ? "opacity-100" : "opacity-0"
            } bg-black overflow-hidden`}
          >
            <YouTube
              videoId={trailerKey}
              className="absolute inset-0 [&>iframe]:absolute [&>iframe]:left-1/2 [&>iframe]:top-1/2 [&>iframe]:h-[56.25vw] [&>iframe]:w-[177.78vh] [&>iframe]:min-h-full [&>iframe]:min-w-full [&>iframe]:-translate-x-1/2 [&>iframe]:-translate-y-1/2 [&>iframe]:block"
              opts={{
                width: "100%",
                height: "100%",
                playerVars: {
                  autoplay: 1,
                  mute: 1,
                  controls: 0,
                  rel: 0,
                  playsinline: 1,
                  iv_load_policy: 3,
                  disablekb: 1,
                  fs: 0,
                  modestbranding: 1,
                },
              }}
              onStateChange={handleVideoState}
              onReady={handleVideoReady}
              onEnd={next}
              onError={() => {
                setTrailerKey(null);
                setVideoReady(false);
                fallbackAdvance();
              }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/60" />

        <div className="absolute left-4 sm:left-auto sm:right-4 md:left-auto md:right-6 lg:left-12 lg:right-auto bottom-4 md:bottom-6 z-20">
          <div className="flex items-center gap-1.5 rounded-full border border-white/35 bg-black/65 backdrop-blur-md px-2 py-1 shadow-[0_6px_22px_rgba(0,0,0,0.55)]">
            <button
              onClick={togglePlay}
              disabled={!trailerKey || !videoReady}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title={isPlaying ? "Pause trailer" : "Play trailer"}
            >
              {isPlaying ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
            </button>

            <button
              onClick={toggleMute}
              disabled={!trailerKey || !videoReady}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title={isMuted ? "Unmute trailer" : "Mute trailer"}
            >
              {isMuted ? <MdVolumeOff size={18} /> : <MdVolumeUp size={18} />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition"
              title="Toggle fullscreen"
            >
              <MdFullscreen size={18} />
            </button>
          </div>
        </div>

        <div className="absolute left-4 sm:left-6 md:left-8 lg:left-12 right-4 md:right-[36%] lg:right-[34%] bottom-8 md:bottom-12 lg:bottom-20 z-10">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-neutral-400 mb-2 md:mb-3">
            Trending
          </p>

          <h1
            onClick={(e) => {
              const isTV =
                current.media_type === "tv" || Boolean(current.first_air_date);
              const path = isTV
                ? `/shows/${current.id}`
                : `/movies/${current.id}`;
              if (e?.metaKey || e?.ctrlKey || e?.button === 1) {
                window.open(path, "_blank", "noopener,noreferrer");
                return;
              }
              navigate(path);
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                const isTV =
                  current.media_type === "tv" ||
                  Boolean(current.first_air_date);
                const path = isTV
                  ? `/shows/${current.id}`
                  : `/movies/${current.id}`;
                window.open(path, "_blank", "noopener,noreferrer");
              }
            }}
            className="text-2xl sm:text-3xl md:text-[42px] xl:text-[52px] font-black leading-tight cursor-pointer hover:text-red-300 transition-colors"
            title="Open details"
          >
            {current.title || current.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[11px] md:text-xs mt-3 md:mt-4 text-neutral-200">
            <span>
              {current.release_date?.slice(0, 4) ||
                current.first_air_date?.slice(0, 4)}
            </span>

            {current.adult === true && (
              <span className="bg-neutral-600 text-[10px] px-1.5 py-[1px] rounded-sm">
                18+
              </span>
            )}

            <span className="flex items-center gap-1 bg-yellow-400 text-black px-[4px] rounded-sm font-semibold">
              <img src={imdbLogo} alt="IMDb" className="w-6 h-6" />
              {current.vote_average?.toFixed(1) || "N/A"}
            </span>

            <span className="line-clamp-1">
              {current.genre_ids
                ?.map((id) => GENRE_MAP[id])
                .filter(Boolean)
                .slice(0, 3)
                .join(" · ")}
            </span>
          </div>

          <div>
            <StatusButtons item={current} />
          </div>
        </div>

        <div className="hidden lg:flex absolute right-6 xl:right-8 top-1/2 -translate-y-1/2 flex-col gap-3 xl:gap-4 z-10">
          {rightRail.map((entry) => {
            const preview = entry.item;
            if (!preview) return null;

            return (
              <button
                key={`${preview.id}-${entry.idx}`}
                onClick={() => setIndex(entry.idx)}
                className="relative w-[250px] xl:w-[280px] h-[104px] xl:h-[120px] rounded-lg overflow-hidden group border border-white/10"
              >
                {preview.backdrop_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/original/${preview.backdrop_path}`}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    alt=""
                  />
                ) : (
                  <div className="absolute inset-0 bg-neutral-800" />
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute bottom-3 left-4 text-left">
                  <p className="text-sm font-semibold line-clamp-1">
                    {preview.title || preview.name}
                  </p>
                  <p className="text-xs text-neutral-300">
                    {preview.release_date?.slice(0, 4) ||
                      preview.first_air_date?.slice(0, 4)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HeroRail;
