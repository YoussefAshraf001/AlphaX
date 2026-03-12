import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { auth, db } from "../firebase";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { IoAdd } from "react-icons/io5";
import {
  FaHeart,
  FaPlay,
  FaRegHeart,
  FaRegStar,
  FaStar,
  FaStarHalfAlt,
} from "react-icons/fa";
import { IoIosClose, IoIosPause } from "react-icons/io";
import { MdDoneOutline } from "react-icons/md";
import { FaTrash } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { FiImage, FiRefreshCw } from "react-icons/fi";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import PersonalRating from "../components/actions/PersonalRating";
import {
  profileLikedActorItemPath,
  profileLikedActorsCollectionPath,
  profileRatingItemPath,
  profileRatingsCollectionPath,
  profileSavedCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";
import {
  isCloudinaryUrl,
  uploadImageToCloudinary,
} from "../utils/cloudinaryUpload";

/* =========================
   STATUS CONFIG
========================= */
const STATUSES = [
  { key: "Want to Watch", icon: <IoAdd size={18} /> },
  { key: "Watching", icon: <FaPlay size={12} /> },
  { key: "Finished", icon: <MdDoneOutline size={14} /> },
  { key: "Paused", icon: <IoIosPause size={14} /> },
  { key: "Dropped", icon: <IoIosClose size={18} /> },
];

const DEFAULT_FILTERS = {
  mediaFilter: "all",
  statusFilter: "all",
  sortFilter: "recent",
};

const ITEMS_PER_PAGE = 28;
const AUTO_METADATA_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTO_METADATA_REFRESH_BATCH_SIZE = 3;

const getItemReleaseDate = (item) =>
  item?.releaseDate || item?.release_date || item?.first_air_date || null;

const getTimestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function")
    return Number(value.toMillis()) || 0;
  if (Number.isFinite(Number(value.seconds))) {
    return Number(value.seconds) * 1000;
  }
  return 0;
};

const isUnknownReleaseDateValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;

  return [
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "unknown",
    "tba",
    "tbd",
    "coming soon",
  ].includes(normalized);
};

const getYearFromReleaseValue = (value) => {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

const sanitizeCloudinarySegment = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildActorPublicId = (email, profileId, actorId) => {
  const safeEmail = sanitizeCloudinarySegment(email || "user");
  const safeProfile = sanitizeCloudinarySegment(profileId || "main");
  const safeActor = sanitizeCloudinarySegment(actorId || "actor");
  return `${safeEmail}_${safeProfile}_${safeActor}`;
};

const buildActorUploadName = (name, actorId) => {
  const safeName = sanitizeCloudinarySegment(name || "actor");
  const safeActor = sanitizeCloudinarySegment(actorId || "actor");
  return safeName ? `${safeName}_${safeActor}` : `actor_${safeActor}`;
};

const buildActorFolder = (name) => {
  const safeName = sanitizeCloudinarySegment(name || "actor");
  return `alphax/actors/${safeName || "actor"}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

const loadImageFromObjectUrl = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });

const compressImageFileToDataUrl = async (
  file,
  { maxDimension = 960, quality = 0.8 } = {},
) => {
  const type = String(file?.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    throw new Error("Please pick an image file");
  }
  if (type === "image/gif") {
    // Keep GIFs unchanged so animation is preserved.
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const srcWidth = Number(image.naturalWidth || image.width || 0);
    const srcHeight = Number(image.naturalHeight || image.height || 0);
    if (srcWidth <= 0 || srcHeight <= 0) {
      throw new Error("Invalid image");
    }

    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to process image");

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/webp", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const getReleasedEpisodeTotalFromShow = (show) => {
  if (!show) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seasonEpisodeCountsBase = Array.isArray(show.seasons)
    ? show.seasons
        .filter(
          (season) =>
            Number(season?.season_number) > 0 &&
            Number(season?.episode_count) > 0,
        )
        .map((season) => ({
          seasonNumber: Number(season.season_number),
          episodeCount: Number(season.episode_count),
          airDate: season.air_date || null,
        }))
    : [];

  const lastAiredSeasonNumber = Number(show.last_episode_to_air?.season_number);
  const lastAiredEpisodeNumber = Number(
    show.last_episode_to_air?.episode_number,
  );
  const hasLastAiredEpisode =
    lastAiredSeasonNumber > 0 && lastAiredEpisodeNumber > 0;

  const releasedSeasonEpisodeCounts = hasLastAiredEpisode
    ? seasonEpisodeCountsBase
        .filter((season) => season.seasonNumber <= lastAiredSeasonNumber)
        .map((season) => ({
          episodeCount:
            season.seasonNumber === lastAiredSeasonNumber
              ? Math.min(season.episodeCount, lastAiredEpisodeNumber)
              : season.episodeCount,
        }))
        .filter((season) => season.episodeCount > 0)
    : seasonEpisodeCountsBase
        .filter((season) => {
          if (!season.airDate) return false;
          const dt = new Date(`${season.airDate}T00:00:00`);
          return !Number.isNaN(dt.getTime()) && dt.getTime() <= today.getTime();
        })
        .map((season) => ({
          episodeCount: season.episodeCount,
        }));

  const hasSeasonAirDateInfo = seasonEpisodeCountsBase.some((season) =>
    Boolean(season.airDate),
  );

  if (releasedSeasonEpisodeCounts.length) {
    return releasedSeasonEpisodeCounts.reduce(
      (sum, season) => sum + season.episodeCount,
      0,
    );
  }

  if (
    !hasSeasonAirDateInfo &&
    Number.isFinite(Number(show.number_of_episodes)) &&
    Number(show.number_of_episodes) > 0
  ) {
    return Number(show.number_of_episodes);
  }

  return 0;
};

const EMOJI_SCALE = [
  "\uD83D\uDE21",
  "\uD83D\uDE15",
  "\uD83D\uDE10",
  "\uD83D\uDE42",
  "\uD83D\uDE0D",
];
const REACTION_LABELS = ["Hate", "Bad", "Okay", "Good", "Love"];

const getStarParts = (value) => {
  const normalized = Math.max(0, Math.min(5, Number(value) || 0));
  if (normalized <= 0) return null;
  const full = Math.floor(normalized);
  const half = normalized - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return { full, half, empty };
};

/* =========================
   MOTION PRESETS
========================= */
const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const slideUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const gridStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.04,
    },
  },
};

const SkeletonGrid = ({ count = 16 }) => (
  <motion.div
    variants={fade}
    initial="hidden"
    animate="show"
    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <motion.div
        key={`skeleton-${idx}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: idx * 0.02 }}
        className="bg-[#111] rounded-lg overflow-hidden border border-white/5"
      >
        <div className="w-full h-[180px] md:h-[230px] bg-white/10 animate-pulse" />
        <div className="p-3 space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
          <div className="h-6 w-full rounded bg-white/10 animate-pulse" />
        </div>
      </motion.div>
    ))}
  </motion.div>
);

/* =========================
   SIDE PANEL
========================= */
const SidePanel = ({
  actors,
  movies,
  shows,
  actorsLoading,
  moviesLoading,
  showsLoading,
  onOpenPath,
  getActorImageSrc,
}) => {
  return (
    <motion.aside
      variants={slideUp}
      initial="hidden"
      animate="show"
      className="
        hidden lg:block
        w-80 shrink-0
        border-l border-white/10
        bg-[#0d0d0d]
        h-screen
        overflow-hidden
        pt-16
      "
    >
      <div className="h-full min-h-0 px-4 py-4 grid grid-rows-3 gap-3">
        <section className="min-h-0 border border-white/10 rounded-xl bg-white/[0.02] p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs uppercase text-white/40">
              Favourite Actors
            </h3>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {actorsLoading ? (
              <motion.div
                key="actors-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex items-center justify-center"
              >
                <ImSpinner2 className="text-white/55 animate-spin" size={18} />
              </motion.div>
            ) : (
              <motion.div
                key="actors-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2 flex-1 min-h-0 pr-1 overflow-y-auto"
              >
                {actors.length ? (
                  actors.map((actor) => (
                    <div
                      key={actor.id}
                      className="group flex items-center gap-3 w-full hover:bg-zinc-700/60 px-2 py-1 rounded-lg transition"
                    >
                      <button
                        onClick={(e) => onOpenPath(e, `/person/${actor.id}`)}
                        onAuxClick={(e) => {
                          if (e.button === 1) {
                            e.preventDefault();
                            onOpenPath(e, `/person/${actor.id}`);
                          }
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <img
                          src={
                            getActorImageSrc(actor, "w185") ||
                            "https://placehold.co/120x120/111111/ffffff?text=Actor"
                          }
                          alt=""
                          className="w-10 h-10 rounded-full object-cover bg-white/10"
                        />
                        <span className="text-sm text-white/80 truncate">
                          {actor.name}
                        </span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-white/40 px-2">
                    No favourite actors yet.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="min-h-0 border border-white/10 rounded-xl bg-white/[0.02] p-3 flex flex-col overflow-hidden">
          <h3 className="text-xs uppercase text-white/40 mb-3">
            Favourite Movies
          </h3>
          <AnimatePresence mode="wait" initial={false}>
            {moviesLoading ? (
              <motion.div
                key="movies-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex items-center justify-center"
              >
                <ImSpinner2 className="text-white/55 animate-spin" size={18} />
              </motion.div>
            ) : (
              <motion.div
                key="movies-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-1 flex-1 min-h-0 pr-1 overflow-y-auto"
              >
                {movies.length ? (
                  movies.map((item) => (
                    <button
                      key={`movie-${item.id}`}
                      onClick={(e) => onOpenPath(e, `/movies/${item.id}`)}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          onOpenPath(e, `/movies/${item.id}`);
                        }
                      }}
                      className="w-full flex items-center gap-2 text-left hover:bg-zinc-700/60 px-2 py-1.5 rounded-md transition"
                    >
                      {item.poster ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${item.poster}`}
                          alt=""
                          className="w-8 h-12 rounded object-cover shrink-0 bg-white/10"
                        />
                      ) : (
                        <div className="w-8 h-12 rounded bg-white/10 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/85 truncate">
                          {item.title}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-white/40 px-2">
                    No movies saved yet.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="min-h-0 border border-white/10 rounded-xl bg-white/[0.02] p-3 flex flex-col overflow-hidden">
          <h3 className="text-xs uppercase text-white/40 mb-3">
            Favourite Shows
          </h3>
          <AnimatePresence mode="wait" initial={false}>
            {showsLoading ? (
              <motion.div
                key="shows-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-h-0 flex items-center justify-center"
              >
                <ImSpinner2 className="text-white/55 animate-spin" size={18} />
              </motion.div>
            ) : (
              <motion.div
                key="shows-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-1 flex-1 min-h-0 pr-1 overflow-y-auto"
              >
                {shows.length ? (
                  shows.map((item) => (
                    <button
                      key={`tv-${item.id}`}
                      onClick={(e) => onOpenPath(e, `/shows/${item.id}`)}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          onOpenPath(e, `/shows/${item.id}`);
                        }
                      }}
                      className="w-full flex items-center gap-2 text-left hover:bg-zinc-700/60 px-2 py-1.5 rounded-md transition"
                    >
                      {item.poster ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${item.poster}`}
                          alt=""
                          className="w-8 h-12 rounded object-cover shrink-0 bg-white/10"
                        />
                      ) : (
                        <div className="w-8 h-12 rounded bg-white/10 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/85 truncate">
                          {item.title}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-white/40 px-2">
                    No shows saved yet.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </motion.aside>
  );
};

/* =========================
   MAIN
========================= */

/* =========================
   CONFIRM MODAL
========================= */
const ConfirmModal = ({ open, item, nextStatus, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-sm"
        >
          <h3 className="text-lg font-semibold mb-2">Change status?</h3>
          <p className="text-sm text-white/60">
            Set <span className="text-white">{item.title}</span> from{" "}
            <span className="text-white">{item.status}</span> to{" "}
            <span className="text-red-400">{nextStatus}</span>?
          </p>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md bg-red-500 hover:bg-white/10 hover:-translate-y-1 ease-in-out transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm rounded-md bg-green-700 hover:bg-green-500 text-white hover:-translate-y-1 ease-in-out transition-all duration-200"
            >
              YES
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const RemoveConfirmModal = ({ open, item, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-sm"
        >
          <h3 className="text-lg font-semibold mb-2">Remove from list?</h3>
          <p className="text-sm text-white/60">
            Remove <span className="text-white">{item?.title}</span> from your
            watchlist?
          </p>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white"
            >
              Remove
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const QuickRateModal = ({
  open,
  item,
  value,
  disabled,
  onRate,
  onClose,
  saving = false,
}) => {
  return (
    <AnimatePresence>
      {open && item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] p-6 md:p-7"
          >
            {saving && (
              <div className="absolute inset-0 z-10 rounded-2xl bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <ImSpinner2 className="text-white text-2xl animate-spin" />
                <p className="text-sm text-white/85">Saving...</p>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-20 rounded overflow-hidden bg-white/10 shrink-0">
                {item.poster ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w185${item.poster}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-white/50">
                  Quick Rate
                </p>
                <h3 className="text-base font-semibold text-white truncate">
                  {item.title}
                </h3>
              </div>
            </div>

            <PersonalRating
              ratingType="stars"
              value={value}
              onRate={onRate}
              disabled={disabled || saving}
              disabledLabel="This title is unreleased. Rating unlocks on release."
              starSizeClass="text-2xl"
              className="bg-white/[0.03]"
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                disabled={saving}
                className={`px-4 py-2 text-sm rounded-md transition ${
                  saving
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-white/10 hover:bg-white/20"
                }`}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const QuickProgressModal = ({
  open,
  item,
  watched,
  total,
  saving,
  onChange,
  onClose,
}) => {
  const [value, setValue] = useState(watched || 0);

  useEffect(() => {
    setValue(watched || 0);
  }, [watched]);

  if (!open || !item) return null;

  const increment = () => {
    if (value < total) {
      const next = value + 1;
      setValue(next);
      onChange(next);
    }
  };

  const decrement = () => {
    if (value > 0) {
      const next = value - 1;
      setValue(next);
      onChange(next);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] p-6 md:p-7"
        >
          {saving && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <ImSpinner2 className="animate-spin text-white text-xl" />
            </div>
          )}

          {/* HEADER */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-20 rounded overflow-hidden bg-white/10">
              {item.poster && (
                <img
                  src={`https://image.tmdb.org/t/p/w185${item.poster}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div>
              <p className="text-xs uppercase text-white/50">
                Episode Progress
              </p>
              <h3 className="text-base font-semibold text-white">
                {item.title}
              </h3>
            </div>
          </div>

          {/* COUNTER */}
          <div className="flex items-center justify-center gap-6 my-6">
            <button
              onClick={decrement}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20"
            >
              -
            </button>

            <div className="text-center">
              <p className="text-3xl font-bold">
                {value}
                <span className="text-white/40 text-lg"> / {total}</span>
              </p>
              <p className="text-xs text-white/50">Episodes watched</p>
            </div>

            <button
              onClick={increment}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500"
            >
              +
            </button>
          </div>

          {/* CLOSE */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const ActorImageSourceModal = ({
  open,
  actor,
  canRemove,
  pendingRemove,
  mode,
  onModeChange,
  linkValue,
  linkValid,
  previewError,
  uploadPreview,
  uploadFileName,
  saving,
  onLinkChange,
  onUploadPick,
  onPreviewError,
  onClose,
  onSave,
  onRemove,
}) => {
  const previewSrc = pendingRemove
    ? ""
    : mode === "upload"
      ? uploadPreview || linkValue.trim()
      : linkValue.trim() || uploadPreview;
  const canPreview = pendingRemove
    ? false
    : mode === "upload"
      ? Boolean(uploadPreview || (linkValue.trim() && linkValid))
      : Boolean((linkValue.trim() && linkValid) || uploadPreview);

  return (
    <AnimatePresence>
      {open && actor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl rounded-2xl bg-gradient-to-b from-[#191919] to-[#101010] p-6 md:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6 pb-4 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">
                  Custom Actor Image
                </p>
                <h3 className="text-lg font-semibold text-white truncate">
                  {actor.name}
                </h3>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
              <div className="rounded-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(0,0,0,0.2))]">
                <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-black/35 shadow-[0_14px_35px_rgba(0,0,0,0.5)] flex items-center justify-center">
                  {!canPreview || previewError ? (
                    <span className="text-xs text-white/45">Preview</span>
                  ) : (
                    <img
                      src={previewSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={onPreviewError}
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex flex-col rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onModeChange("upload")}
                      disabled={saving}
                      className={`px-3.5 py-2 rounded-md text-xs border transition ${
                        mode === "upload"
                          ? "bg-red-500/20 border-red-400/50 text-white"
                          : "bg-white/5 border-white/10 text-white/45"
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => onModeChange("link")}
                      disabled={saving}
                      className={`px-3.5 py-2 rounded-md text-xs border transition ${
                        mode === "link"
                          ? "bg-red-500/20 border-red-400/50 text-white"
                          : "bg-white/5 border-white/10 text-white/45"
                      }`}
                    >
                      Image URL
                    </button>
                  </div>
                  {canRemove && (
                    <button
                      onClick={onRemove}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs rounded-md border border-red-300/40 text-red-200 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {pendingRemove ? "Undo Remove" : "Remove"}
                    </button>
                  )}
                </div>
                {mode === "upload" ? (
                  <div className="space-y-3">
                    <label className="block text-xs text-white/60">
                      Upload Image
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="actor-image-upload-input"
                        type="file"
                        accept="image/*"
                        disabled={saving}
                        onChange={onUploadPick}
                        className="hidden"
                      />
                      <label
                        htmlFor="actor-image-upload-input"
                        className={`inline-flex items-center px-3 py-2 rounded-md text-xs transition ${
                          saving
                            ? "bg-zinc-800 text-white/40 cursor-not-allowed"
                            : "bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer"
                        }`}
                      >
                        Browse...
                      </label>
                      <p className="text-xs text-white/60 min-w-0 truncate">
                        {uploadFileName || "No file selected."}
                      </p>
                    </div>
                    <p className="text-xs text-white/45">
                      Pick an image file to apply as the custom actor image.
                    </p>
                    {pendingRemove && (
                      <p className="text-xs text-red-300">
                        Image removal is queued. Click Save Image to confirm.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-xs text-white/60">
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={linkValue}
                      onChange={(e) => onLinkChange(e.target.value)}
                      placeholder="https://example.com/actor.jpg"
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/35"
                      autoFocus
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && linkValid && !saving) {
                          onSave();
                        }
                      }}
                    />
                    {linkValue.trim().length > 0 && !linkValid && (
                      <p className="text-xs text-red-300">
                        Enter a valid `http` or `https` image URL.
                      </p>
                    )}
                    <p className="text-xs text-white/45">
                      Tip: use direct image links (`.jpg`, `.png`, `.webp`) for
                      reliable previews.
                    </p>
                    {pendingRemove && (
                      <p className="text-xs text-red-300">
                        Image removal is queued. Click Save Image to confirm.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={
                  saving ||
                  (!pendingRemove &&
                    (mode === "link" ? !linkValid : !uploadPreview))
                }
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
              >
                {saving && (
                  <span className="loading loading-spinner loading-xs text-white" />
                )}
                {saving ? "Saving..." : "Save Image"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* =========================
   TOAST
========================= */
const Toast = ({ message, onClose }) =>
  createPortal(
    <div className="fixed inset-x-0 top-20 z-[1200] flex justify-center px-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="pointer-events-auto w-[min(92vw,680px)] bg-[#0d0d0d]/95 border border-red-600/80 text-white shadow-[0_10px_32px_rgba(0,0,0,0.65)] px-4 py-3 rounded-lg text-sm backdrop-blur-md"
      >
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 break-words leading-6">{message}</p>
          <button
            onClick={onClose}
            className="shrink-0 text-red-300/70 hover:text-red-200"
          >
            x
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );

const Account = () => {
  const navigate = useNavigate();
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const snapshotUnsubsRef = useRef([]);
  const activeProfileId = resolveProfileId(selectedProfile);

  const openPath = (event, path) => {
    if (event?.metaKey || event?.ctrlKey || event?.button === 1) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(path);
  };

  const [items, setItems] = useState([]);
  const [actors, setActors] = useState([]);
  const [actorRatingsById, setActorRatingsById] = useState({});

  const [mediaFilter, setMediaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortFilter, setSortFilter] = useState("recent");
  const [pageBySection, setPageBySection] = useState({});
  const [loading, setLoading] = useState(true);
  const [sidePanelReady, setSidePanelReady] = useState({
    actors: false,
    movies: false,
    shows: false,
  });
  const [confirm, setConfirm] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [quickRate, setQuickRate] = useState(null);
  const [savingQuickRate, setSavingQuickRate] = useState(false);
  const [quickProgress, setQuickProgress] = useState(null);
  const [savingProgress, setSavingProgress] = useState(false);
  const [refreshingItemKeys, setRefreshingItemKeys] = useState({});
  const [savingActorImageId, setSavingActorImageId] = useState(null);
  const [refreshingActorImageId, setRefreshingActorImageId] = useState(null);
  const [actorImageModal, setActorImageModal] = useState({
    open: false,
    actor: null,
  });
  const [actorImageMode, setActorImageMode] = useState("upload");
  const [actorImageLinkValue, setActorImageLinkValue] = useState("");
  const [actorImageUploadPreview, setActorImageUploadPreview] = useState("");
  const [actorImageUploadFileName, setActorImageUploadFileName] = useState("");
  const [actorImageLinkPreviewError, setActorImageLinkPreviewError] =
    useState(false);
  const [pendingActorImageRemoval, setPendingActorImageRemoval] =
    useState(false);
  const [actorHoverValueById, setActorHoverValueById] = useState({});
  const [loadedPosterKeys, setLoadedPosterKeys] = useState({});
  const [failedPosterKeys, setFailedPosterKeys] = useState({});
  const [wantWatchSections, setWantWatchSections] = useState({
    movieReleased: true,
    movieUnreleased: true,
    tvReleased: true,
    tvUnreleased: true,
  });
  const [toast, setToast] = useState(null);
  const actorImageHydrationRef = useRef(new Set());
  const autoRefreshAttemptedAtRef = useRef({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("libraryFilters");
      if (!raw) return;

      const saved = JSON.parse(raw);

      if (saved.mediaFilter) setMediaFilter(saved.mediaFilter);
      if (saved.statusFilter) setStatusFilter(saved.statusFilter);
      if (saved.sortFilter) setSortFilter(saved.sortFilter);
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "libraryFilters",
      JSON.stringify({
        mediaFilter,
        statusFilter,
        sortFilter,
      }),
    );
  }, [mediaFilter, statusFilter, sortFilter]);

  const clearFilters = () => {
    setMediaFilter(DEFAULT_FILTERS.mediaFilter);
    setStatusFilter(DEFAULT_FILTERS.statusFilter);
    setSortFilter(DEFAULT_FILTERS.sortFilter);
    localStorage.removeItem("libraryFilters");
  };

  const getActorImageSrc = (actor, size = "w185") => {
    if (!actor) return null;
    const raw = String(actor.image || "").trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image/")) {
      const isCloudinary = /^https?:\/\/res\.cloudinary\.com\/.+/i.test(raw);
      const version = Number(actor?.customImage?.version || 0);
      if (isCloudinary && version > 0) {
        const hasQuery = raw.includes("?");
        return `${raw}${hasQuery ? "&" : "?"}v=${version}`;
      }
      return raw;
    }
    if (raw.startsWith("/")) return `https://image.tmdb.org/t/p/${size}${raw}`;
    return `https://image.tmdb.org/t/p/${size}/${raw}`;
  };

  const markPosterLoaded = (posterKey) => {
    if (!posterKey) return;
    setLoadedPosterKeys((prev) =>
      prev[posterKey] ? prev : { ...prev, [posterKey]: true },
    );
  };

  const markPosterFailed = (posterKey) => {
    if (!posterKey) return;
    setFailedPosterKeys((prev) =>
      prev[posterKey] ? prev : { ...prev, [posterKey]: true },
    );
  };

  /* =========================
     FETCH DATA
  ========================== */
  useEffect(() => {
    const clearSnapshotListeners = () => {
      snapshotUnsubsRef.current.forEach((fn) => {
        if (typeof fn === "function") fn();
      });
      snapshotUnsubsRef.current = [];
    };

    const unsubAuth = auth.onAuthStateChanged((nextUser) => {
      clearSnapshotListeners();

      if (!nextUser) {
        setItems([]);
        setActors([]);
        setLoading(false);
        setSidePanelReady({ actors: true, movies: true, shows: true });
        return;
      }

      setLoading(true);
      setSidePanelReady({ actors: false, movies: false, shows: false });
      const moviesRef = collection(
        db,
        ...profileSavedCollectionPath(
          nextUser.email,
          activeProfileId,
          "movies",
        ),
      );
      const tvRef = collection(
        db,
        ...profileSavedCollectionPath(nextUser.email, activeProfileId, "shows"),
      );
      const movieRatingsRef = collection(
        db,
        ...profileRatingsCollectionPath(
          nextUser.email,
          activeProfileId,
          "movies",
        ),
      );
      const showRatingsRef = collection(
        db,
        ...profileRatingsCollectionPath(
          nextUser.email,
          activeProfileId,
          "shows",
        ),
      );
      const actorRatingsRef = collection(
        db,
        ...profileRatingsCollectionPath(
          nextUser.email,
          activeProfileId,
          "actors",
        ),
      );
      const actorsRef = collection(
        db,
        ...profileLikedActorsCollectionPath(nextUser.email, activeProfileId),
      );

      let movies = [];
      let tv = [];
      let movieRatings = [];
      let showRatings = [];
      let moviesReady = false;
      let tvReady = false;
      let movieRatingsReady = false;
      let showRatingsReady = false;

      const sync = () => {
        const ratingMap = new Map();
        movieRatings.forEach((r) => ratingMap.set(`movie:${r.id}`, r));
        showRatings.forEach((r) => ratingMap.set(`tv:${r.id}`, r));

        setItems(
          [...movies, ...tv].map((item) => {
            const key = `${item.mediaType}:${item.id}`;
            const rating = ratingMap.get(key);
            return {
              ...item,
              userRatingValue: Number(rating?.value || 0),
            };
          }),
        );
        if (moviesReady && tvReady && movieRatingsReady && showRatingsReady) {
          setLoading(false);
        }
      };

      const unsubMovies = onSnapshot(moviesRef, (snap) => {
        movies = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            ...data,
            status: data.status === "Watched" ? "Finished" : data.status,
          };
        });
        moviesReady = true;
        setSidePanelReady((prev) => ({ ...prev, movies: true }));
        sync();
      });

      const unsubTv = onSnapshot(tvRef, (snap) => {
        tv = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            ...data,
            status: data.status === "Watched" ? "Finished" : data.status,
          };
        });
        tvReady = true;
        setSidePanelReady((prev) => ({ ...prev, shows: true }));
        sync();
      });

      const unsubMovieRatings = onSnapshot(movieRatingsRef, (snap) => {
        movieRatings = snap.docs.map((d) => d.data());
        movieRatingsReady = true;
        sync();
      });

      const unsubShowRatings = onSnapshot(showRatingsRef, (snap) => {
        showRatings = snap.docs.map((d) => d.data());
        showRatingsReady = true;
        sync();
      });

      const unsubActors = onSnapshot(
        query(actorsRef, orderBy("updatedAt", "desc")),
        (snap) => {
          setActors(snap.docs.map((d) => d.data()));
          setSidePanelReady((prev) => ({ ...prev, actors: true }));
          sync();
        },
      );

      const unsubActorRatings = onSnapshot(actorRatingsRef, (snap) => {
        const next = {};
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          next[String(data.id ?? d.id)] = data;
        });
        setActorRatingsById(next);
      });

      snapshotUnsubsRef.current = [
        unsubMovies,
        unsubTv,
        unsubMovieRatings,
        unsubShowRatings,
        unsubActors,
        unsubActorRatings,
      ];
    });

    return () => {
      clearSnapshotListeners();
      unsubAuth();
    };
  }, [activeProfileId]);

  /* =========================
     UPDATE STATUS
  ========================== */
  const updateStatus = async (item, status) => {
    const user = auth.currentUser;
    if (!user) return;

    const oldStatus = item.status;

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              status,
              notInterested: false,
              dropReason: "",
            }
          : i,
      ),
    );

    const ref = doc(
      db,
      ...profileSavedItemPath(
        user.email,
        activeProfileId,
        item.mediaType === "movie" ? "movies" : "shows",
        item.id,
      ),
    );

    await setDoc(
      ref,
      {
        status,
        notInterested: false,
        dropReason: null,
      },
      { merge: true },
    );

    setToast(`${item.title} â€” ${oldStatus} â†’ ${status}`);
    setTimeout(() => setToast(null), 3000);
  };

  /* =========================
     FILTER
  ========================== */
  const removeFromList = async (item) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(
      db,
      ...profileSavedItemPath(
        user.email,
        activeProfileId,
        item.mediaType === "movie" ? "movies" : "shows",
        item.id,
      ),
    );

    try {
      await deleteDoc(ref);
      setItems((prev) =>
        prev.filter(
          (i) => !(i.id === item.id && i.mediaType === item.mediaType),
        ),
      );
      setToast(`Removed "${item.title}" from your list`);
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Failed to remove item");
      setTimeout(() => setToast(null), 3000);
    }
  };

  const removeActor = async (actor) => {
    const user = auth.currentUser;
    if (!user) return;

    const favRef = doc(
      db,
      ...profileLikedActorItemPath(user.email, activeProfileId, actor.id),
    );

    const ratingRef = doc(
      db,
      ...profileRatingItemPath(user.email, activeProfileId, "actors", actor.id),
    );

    // Move image safely to rating doc BEFORE unfav
    await setDoc(
      ratingRef,
      {
        id: Number(actor.id),
        title: actor.name,
        image: actor.image || null,
        mediaType: "person",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Now remove favourite doc
    await deleteDoc(favRef);

    setActors((prev) => prev.filter((a) => a.id !== actor.id));

    setToast(`Removed ${actor.name} from favourites`);
    setTimeout(() => setToast(null), 3000);
  };

  const toggleFavourite = async (item) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (isUnreleasedItem(item)) {
      setToast("Favourites unlock on release");
      setTimeout(() => setToast(null), 2500);
      return;
    }

    const next = !Boolean(item.favourite);
    const ref = doc(
      db,
      ...profileSavedItemPath(
        currentUser.email,
        activeProfileId,
        item.mediaType === "movie" ? "movies" : "shows",
        item.id,
      ),
    );

    try {
      await setDoc(ref, { favourite: next }, { merge: true });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id && i.mediaType === item.mediaType
            ? { ...i, favourite: next }
            : i,
        ),
      );
      setToast(next ? "Added to favourites" : "Removed from favourites");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Failed to update favourite");
      setTimeout(() => setToast(null), 3000);
    }
  };

  const hydrateActorImageDraftFromActor = (actor) => {
    const rawImage = String(actor?.image || "").trim();
    const savedSource = String(actor?.customImage?.source || "").toLowerCase();
    const isCloudImage = isCloudinaryUrl(rawImage);

    if (savedSource === "link" && isCloudImage) {
      setActorImageMode("link");
      setActorImageLinkValue(rawImage);
      setActorImageUploadPreview("");
      setActorImageUploadFileName("");
    } else if (savedSource === "upload" && isCloudImage) {
      setActorImageMode("upload");
      setActorImageLinkValue("");
      setActorImageUploadPreview(rawImage);
      setActorImageUploadFileName(
        String(actor?.customImage?.fileName || "Saved uploaded image"),
      );
    } else {
      setActorImageMode("upload");
      setActorImageLinkValue("");
      setActorImageUploadPreview("");
      setActorImageUploadFileName("");
    }
    setActorImageLinkPreviewError(false);
  };

  const openActorImageModal = (actor) => {
    setActorImageModal({ open: true, actor });
    setPendingActorImageRemoval(false);
    hydrateActorImageDraftFromActor(actor);
  };

  const refreshActorImageFromSource = async (actor) => {
    const currentUser = auth.currentUser;
    if (
      !currentUser?.email ||
      !actor ||
      refreshingActorImageId === Number(actor.id)
    )
      return;
    setRefreshingActorImageId(Number(actor.id));
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/person/${actor.id}`,
        { params: { api_key: process.env.REACT_APP_TMDB_API_KEY } },
      );
      const data = response.data || {};
      const isFavouriteActor = actors.some(
        (a) => String(a.id) === String(actor.id),
      );
      if (isFavouriteActor) {
        const actorRef = doc(
          db,
          ...profileLikedActorItemPath(
            currentUser.email,
            activeProfileId,
            actor.id,
          ),
        );
        await setDoc(
          actorRef,
          {
            id: Number(actor.id),
            name: data.name || actor.name || "",
            image: data.profile_path ?? null,
            customImage: deleteField(),
            updatedAt: serverTimestamp(),
            metadataUpdatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setActors((prev) =>
          prev.map((a) =>
            String(a.id) === String(actor.id)
              ? {
                  ...a,
                  name: data.name || a.name,
                  image: data.profile_path ?? null,
                }
              : a,
          ),
        );
      } else {
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            currentUser.email,
            activeProfileId,
            "actors",
            actor.id,
          ),
        );
        await setDoc(
          ratingRef,
          {
            id: Number(actor.id),
            title: data.name || actor.name || "",
            image: data.profile_path ?? null,
            mediaType: "person",
            mode: "emoji",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setActorRatingsById((prev) => ({
          ...prev,
          [String(actor.id)]: {
            ...(prev[String(actor.id)] || {}),
            id: Number(actor.id),
            title:
              data.name ||
              actor.name ||
              prev[String(actor.id)]?.title ||
              `Actor #${actor.id}`,
            image: data.profile_path ?? null,
          },
        }));
      }
      setToast(`Refreshed "${data.name || actor.name}"`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast(`Failed to refresh "${actor.name}"`);
      setTimeout(() => setToast(null), 2500);
    } finally {
      setRefreshingActorImageId(null);
    }
  };

  const addActorToFavourites = async (actor) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(
      db,
      ...profileLikedActorItemPath(user.email, activeProfileId, actor.id),
    );

    await setDoc(
      ref,
      {
        id: Number(actor.id),
        name: actor.name,
        image: actor.image || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setToast(`${actor.name} is now in Favourites`);
  };

  const saveActorImage = async (actor, nextImage) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email || !actor || !nextImage) return false;
    setSavingActorImageId(Number(actor.id));
    try {
      const cleanedImage = String(nextImage).trim();
      const customSource = cleanedImage.startsWith("data:image/")
        ? "upload"
        : actorImageMode === "link"
          ? "link"
          : "upload";
      const actorPublicId = buildActorPublicId(
        currentUser.email,
        activeProfileId,
        actor.id,
      );
      const uploaded = await uploadImageToCloudinary(cleanedImage, {
        folder: buildActorFolder(actor?.name),
        tags: ["alphax", "actor", customSource],
        publicId: `${actorPublicId}_${Date.now()}`,
        filenameOverride: buildActorUploadName(actor?.name, actor?.id),
      });
      if (!uploaded?.url) {
        throw new Error("Image upload failed");
      }

      const customImage = {
        source: customSource,
        storage: "cloudinary",
        publicId: uploaded.publicId || null,
        version: uploaded.version || null,
        width: uploaded.width || null,
        height: uploaded.height || null,
        format: uploaded.format || null,
        fileName:
          customSource === "upload"
            ? actorImageUploadFileName || "Uploaded image"
            : null,
      };
      const isFavouriteActor = actors.some(
        (a) => String(a.id) === String(actor.id),
      );
      if (isFavouriteActor) {
        const actorRef = doc(
          db,
          ...profileLikedActorItemPath(
            currentUser.email,
            activeProfileId,
            actor.id,
          ),
        );
        await setDoc(
          actorRef,
          {
            id: Number(actor.id),
            name: actor.name || "",
            image: uploaded.url,
            customImage,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            currentUser.email,
            activeProfileId,
            "actors",
            actor.id,
          ),
        );
        await setDoc(
          ratingRef,
          {
            id: Number(actor.id),
            title: actor.name || "",
            image: uploaded.url,
            mediaType: "person",
            customImage,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setActors((prev) =>
          prev.map((a) =>
            String(a.id) === String(actor.id)
              ? { ...a, image: uploaded.url, customImage }
              : a,
          ),
        );
        setActorRatingsById((prev) => ({
          ...prev,
          [String(actor.id)]: {
            ...(prev[String(actor.id)] || {}),
            id: Number(actor.id),
            title: actor.name || prev[String(actor.id)]?.title || "",
            image: uploaded.url,
            mediaType: "person",
            customImage,
          },
        }));
      } else {
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            currentUser.email,
            activeProfileId,
            "actors",
            actor.id,
          ),
        );
        await setDoc(
          ratingRef,
          {
            id: Number(actor.id),
            title: actor.name || "",
            image: uploaded.url,
            customImage,
          },
          { merge: true },
        );
        setActorRatingsById((prev) => ({
          ...prev,
          [String(actor.id)]: {
            ...(prev[String(actor.id)] || {}),
            id: Number(actor.id),
            title: actor.name || prev[String(actor.id)]?.title || "",
            image: uploaded.url,
            customImage,
          },
        }));
      }
      setToast(`Updated image for "${actor.name}"`);
      setTimeout(() => setToast(null), 2500);
      return true;
    } catch (err) {
      const reason = String(err?.message || "").trim();
      setToast(
        reason
          ? `Failed to update actor image: ${reason}`
          : "Failed to update actor image",
      );
      setTimeout(() => setToast(null), 2500);
      return false;
    } finally {
      setSavingActorImageId(null);
    }
  };

  const closeActorImageModal = () => {
    const actorId = Number(actorImageModal.actor?.id);
    if (
      savingActorImageId != null &&
      actorId > 0 &&
      savingActorImageId === actorId
    )
      return;
    setActorImageModal({ open: false, actor: null });
    setActorImageMode("upload");
    setActorImageLinkValue("");
    setActorImageUploadPreview("");
    setActorImageUploadFileName("");
    setActorImageLinkPreviewError(false);
    setPendingActorImageRemoval(false);
  };

  const actorImageLinkCleaned = actorImageLinkValue.trim();
  const actorImageLinkValid = /^https?:\/\/\S+$/i.test(actorImageLinkCleaned);
  const actorHasCustomImage = (() => {
    const actor = actorImageModal.actor;
    if (!actor) return false;

    const source = String(actor?.customImage?.source || "").toLowerCase();
    const storage = String(actor?.customImage?.storage || "").toLowerCase();
    const rawImage = String(actor?.image || "").trim();
    return (
      (source === "upload" || source === "link") &&
      storage === "cloudinary" &&
      isCloudinaryUrl(rawImage)
    );
  })();

  const onActorImageUploadPicked = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setToast("Please pick an image file");
      setTimeout(() => setToast(null), 2500);
      setActorImageUploadPreview("");
      setActorImageUploadFileName("");
      return;
    }
    setActorImageUploadFileName(String(file.name || "Selected image"));
    setPendingActorImageRemoval(false);
    try {
      const result = await compressImageFileToDataUrl(file, {
        maxDimension: 960,
        quality: 0.8,
      });
      setActorImageUploadPreview(result);
      setActorImageLinkPreviewError(false);
    } catch {
      setToast("Failed to read image");
      setTimeout(() => setToast(null), 2500);
      setActorImageUploadPreview("");
      setActorImageUploadFileName("");
    }
  };

  const saveActorImageFromModal = async () => {
    const actor = actorImageModal.actor;
    if (!actor) return;
    if (pendingActorImageRemoval) {
      await removeActorImageFromModal();
      return;
    }
    const source =
      actorImageMode === "link"
        ? actorImageLinkCleaned
        : String(actorImageUploadPreview || "");
    if (!source || (actorImageMode === "link" && !actorImageLinkValid)) return;
    const saved = await saveActorImage(actor, source);
    if (saved) {
      closeActorImageModal();
    }
  };

  const removeActorImageFromModal = async () => {
    const actor = actorImageModal.actor;
    const currentUser = auth.currentUser;
    if (!actor || !currentUser?.email) return;

    const actorId = Number(actor.id);
    if (!Number.isFinite(actorId) || actorId <= 0) return;

    setSavingActorImageId(actorId);
    try {
      const isFavouriteActor = actors.some(
        (a) => String(a.id) === String(actorId),
      );

      if (isFavouriteActor) {
        const actorRef = doc(
          db,
          ...profileLikedActorItemPath(
            currentUser.email,
            activeProfileId,
            actorId,
          ),
        );
        await setDoc(
          actorRef,
          {
            id: actorId,
            image: null,
            customImage: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            currentUser.email,
            activeProfileId,
            "actors",
            actorId,
          ),
        );
        await setDoc(
          ratingRef,
          {
            id: actorId,
            image: null,
            customImage: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setActors((prev) =>
          prev.map((a) =>
            String(a.id) === String(actorId)
              ? { ...a, image: null, customImage: undefined }
              : a,
          ),
        );
      } else {
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(
            currentUser.email,
            activeProfileId,
            "actors",
            actorId,
          ),
        );
        await setDoc(
          ratingRef,
          {
            id: actorId,
            image: null,
            customImage: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setActorRatingsById((prev) => ({
          ...prev,
          [String(actorId)]: {
            ...(prev[String(actorId)] || {}),
            id: actorId,
            image: null,
            customImage: undefined,
          },
        }));
      }

      setActorImageLinkValue("");
      setActorImageUploadPreview("");
      setActorImageUploadFileName("");
      setActorImageLinkPreviewError(false);

      setToast(`Removed custom image for "${actor.name}"`);
      setTimeout(() => setToast(null), 2500);
      closeActorImageModal();
    } catch {
      setToast("Failed to remove actor image");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSavingActorImageId(null);
    }
  };

  const queueActorImageRemovalFromModal = () => {
    const actor = actorImageModal.actor;
    if (!actor) return;

    if (pendingActorImageRemoval) {
      setPendingActorImageRemoval(false);
      hydrateActorImageDraftFromActor(actor);
      return;
    }

    setPendingActorImageRemoval(true);
    setActorImageLinkValue("");
    setActorImageUploadPreview("");
    setActorImageUploadFileName("");
    setActorImageLinkPreviewError(false);
  };

  const openQuickRate = (item) => {
    const currentValue = Math.max(
      0,
      Math.min(5, Number(item.userRatingValue) || 0),
    );
    setQuickRate({
      item,
      value: currentValue,
    });
  };

  const saveActorRating = async (actor, nextValue) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email || !actor) return;
    const normalized = Math.max(1, Math.min(5, Number(nextValue) || 0));
    const ref = doc(
      db,
      ...profileRatingItemPath(
        currentUser.email,
        activeProfileId,
        "actors",
        actor.id,
      ),
    );
    try {
      await setDoc(
        ref,
        {
          id: Number(actor.id),
          title:
            actor.name || actorRatingsById?.[String(actor.id)]?.title || "",
          image:
            actor.image ||
            actorRatingsById?.[String(actor.id)]?.image ||
            actor.profile_path ||
            null,
          mediaType: "person",
          mode: "emoji",
          value: normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setActorRatingsById((prev) => ({
        ...prev,
        [String(actor.id)]: {
          ...(prev[String(actor.id)] || {}),
          id: Number(actor.id),
          title: actor.name || prev[String(actor.id)]?.title || "",
          image:
            actor.image ||
            prev[String(actor.id)]?.image ||
            actor.profile_path ||
            null,
          mediaType: "person",
          mode: "emoji",
          value: normalized,
        },
      }));
    } catch {
      setToast("Failed to save actor reaction");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const closeQuickRate = () => setQuickRate(null);

  const saveQuickRate = async (nextValue = null) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !quickRate?.item || savingQuickRate) return;

    const { item } = quickRate;
    const value = nextValue == null ? quickRate.value : nextValue;
    if (isUnreleasedItem(item)) {
      setToast("Rating unlocks on release");
      setTimeout(() => setToast(null), 2500);
      return;
    }

    const clamped = Math.max(0, Math.min(5, Number(value) || 0));
    const typeDoc = item.mediaType === "tv" ? "shows" : "movies";
    const ratingRef = doc(
      db,
      ...profileRatingItemPath(
        currentUser.email,
        activeProfileId,
        typeDoc,
        item.id,
      ),
    );

    try {
      setSavingQuickRate(true);
      if (clamped === 0) {
        await deleteDoc(ratingRef);
      } else {
        await setDoc(
          ratingRef,
          {
            id: Number(item.id),
            title: item.title,
            mediaType: item.mediaType,
            mode: "stars",
            value: clamped,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id && entry.mediaType === item.mediaType
            ? {
                ...entry,
                userRatingValue: clamped,
              }
            : entry,
        ),
      );
      setQuickRate((prev) =>
        prev
          ? {
              ...prev,
              value: clamped,
            }
          : prev,
      );
      setToast(clamped > 0 ? "Rating saved" : "Rating cleared");
      setTimeout(() => setToast(null), 2500);
      closeQuickRate();
    } catch {
      setToast("Failed to save rating");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSavingQuickRate(false);
    }
  };

  const saveProgress = async (item, watched) => {
    const user = auth.currentUser;
    if (!user) return;

    setSavingProgress(true);

    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, "shows", item.id),
    );

    await setDoc(
      ref,
      {
        watchedEpisodes: watched,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    setSavingProgress(false);
  };

  const refreshSavedMetadata = useCallback(
    async (item, options = {}) => {
      const { silent = false } = options;
      const currentUser = auth.currentUser;
      if (!currentUser || !item) return;

      const refreshKey = `${item.mediaType}-${item.id}`;
      if (refreshingItemKeys[refreshKey]) return;

      const isValidItem =
        Number(item?.id) > 0 &&
        (item.mediaType === "movie" || item.mediaType === "tv");
      if (!isValidItem) {
        if (!silent) {
          setToast("Nothing to refresh");
          setTimeout(() => setToast(null), 2500);
        }
        return;
      }

      setRefreshingItemKeys((prev) => ({ ...prev, [refreshKey]: true }));
      try {
        const isTv = item.mediaType === "tv";
        const endpointType = isTv ? "tv" : "movie";
        const savedTypeDoc = isTv ? "shows" : "movies";
        const response = await axios.get(
          `https://api.themoviedb.org/3/${endpointType}/${item.id}`,
          { params: { api_key: process.env.REACT_APP_TMDB_API_KEY } },
        );
        const data = response.data || {};
        const releasedEpisodeTotal = isTv
          ? getReleasedEpisodeTotalFromShow(data)
          : 0;
        const trackedEpisodes = Number(item.totalEpisodes || 0);
        const watchedEpisodes = Number(item.watchedEpisodes || 0);
        const shouldMoveToWantToWatch =
          isTv &&
          item.status === "Finished" &&
          trackedEpisodes > 0 &&
          watchedEpisodes >= trackedEpisodes &&
          releasedEpisodeTotal > trackedEpisodes;

        const payload = isTv
          ? {
              title: data.name || item.title || "",
              poster: data.poster_path ?? item.poster ?? null,
              backdrop: data.backdrop_path ?? item.backdrop ?? null,
              overview: data.overview ?? item.overview ?? null,
              releaseDate: data.first_air_date ?? item.releaseDate ?? null,
              rating: data.vote_average ?? item.rating ?? null,
              runtime:
                (Array.isArray(data.episode_run_time) &&
                  data.episode_run_time.find((v) => Number(v) > 0)) ||
                item.runtime ||
                null,
              totalEpisodes:
                releasedEpisodeTotal > 0
                  ? releasedEpisodeTotal
                  : item.totalEpisodes || null,
              totalSeasons:
                Number.isFinite(Number(data.number_of_seasons)) &&
                Number(data.number_of_seasons) > 0
                  ? Number(data.number_of_seasons)
                  : item.totalSeasons || null,
              status: shouldMoveToWantToWatch ? "Watching" : item.status,
            }
          : {
              title: data.title || item.title || "",
              poster: data.poster_path ?? item.poster ?? null,
              backdrop: data.backdrop_path ?? item.backdrop ?? null,
              overview: data.overview ?? item.overview ?? null,
              releaseDate: data.release_date ?? item.releaseDate ?? null,
              rating: data.vote_average ?? item.rating ?? null,
              runtime:
                Number.isFinite(Number(data.runtime)) &&
                Number(data.runtime) > 0
                  ? Number(data.runtime)
                  : item.runtime || null,
            };

        const ref = doc(
          db,
          ...profileSavedItemPath(
            currentUser.email,
            activeProfileId,
            savedTypeDoc,
            item.id,
          ),
        );
        await setDoc(
          ref,
          {
            ...payload,
            metadataUpdatedAt: serverTimestamp(),
            ...(isTv ? { newEpisodeStatusCheckedAt: serverTimestamp() } : {}),
            ...(shouldMoveToWantToWatch
              ? { updatedAt: serverTimestamp() }
              : {}),
          },
          { merge: true },
        );
        if (!silent) {
          setToast(
            shouldMoveToWantToWatch
              ? `New episodes released for "${item.title}". It's now moved to Watching`
              : `Refreshed "${item.title}"`,
          );
          setTimeout(() => setToast(null), 2500);
        }
      } catch {
        if (!silent) {
          setToast(`Failed to refresh "${item.title}"`);
          setTimeout(() => setToast(null), 2500);
        }
      } finally {
        setRefreshingItemKeys((prev) => {
          const next = { ...prev };
          delete next[refreshKey];
          return next;
        });
      }
    },
    [activeProfileId, refreshingItemKeys],
  );

  const visible = items.filter((i) => {
    if (mediaFilter === "actors") return false;
    if (mediaFilter !== "all" && i.mediaType !== mediaFilter) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const sortedVisible = [...visible].sort((a, b) => {
    const dateA = Number(a.updatedAt?.seconds || 0);
    const dateB = Number(b.updatedAt?.seconds || 0);
    const ratingA = Number(a.userRatingValue || 0);
    const ratingB = Number(b.userRatingValue || 0);
    const favA = Number(Boolean(a.favourite));
    const favB = Number(Boolean(b.favourite));

    if (sortFilter === "highest_rated") {
      if (ratingB !== ratingA) return ratingB - ratingA;
      return dateB - dateA;
    }

    if (sortFilter === "favourites") {
      if (favB !== favA) return favB - favA;
      return dateB - dateA;
    }

    if (sortFilter === "title_az") {
      return String(a.title || "").localeCompare(String(b.title || ""));
    }

    return dateB - dateA;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isUnreleasedItem = (item) => {
    const release = getItemReleaseDate(item);
    if (isUnknownReleaseDateValue(release)) return true;
    const date = new Date(release);
    if (Number.isNaN(date.getTime())) {
      const releaseYear = getYearFromReleaseValue(release);
      if (releaseYear !== null) {
        return releaseYear > today.getFullYear();
      }
      return true;
    }
    return date > today;
  };

  useEffect(() => {
    if (!user || !items.length) return;

    const now = Date.now();
    const candidates = items
      .filter((item) => {
        if (item.status !== "Want to Watch") return false;
        if (item.mediaType !== "movie" && item.mediaType !== "tv") return false;
        if (!isUnknownReleaseDateValue(getItemReleaseDate(item))) return false;

        const refreshKey = `${item.mediaType}-${item.id}`;
        if (refreshingItemKeys[refreshKey]) return false;

        const lastMetadataUpdateMs = getTimestampMillis(item.metadataUpdatedAt);
        const lastAttemptMs = Number(
          autoRefreshAttemptedAtRef.current[refreshKey] || 0,
        );
        const lastCheckedMs = Math.max(lastMetadataUpdateMs, lastAttemptMs);
        return now - lastCheckedMs >= AUTO_METADATA_REFRESH_COOLDOWN_MS;
      })
      .slice(0, AUTO_METADATA_REFRESH_BATCH_SIZE);

    if (!candidates.length) return;

    candidates.forEach((item) => {
      const refreshKey = `${item.mediaType}-${item.id}`;
      autoRefreshAttemptedAtRef.current[refreshKey] = now;
      refreshSavedMetadata(item, { silent: true });
    });
  }, [items, refreshingItemKeys, refreshSavedMetadata, user]);

  useEffect(() => {
    if (!user || !items.length) return;

    const now = Date.now();
    const candidates = items
      .filter((item) => {
        if (item.mediaType !== "tv") return false;
        if (item.status !== "Finished") return false;

        const trackedEpisodes = Number(item.totalEpisodes || 0);
        const watchedEpisodes = Number(item.watchedEpisodes || 0);
        if (trackedEpisodes <= 0 || watchedEpisodes < trackedEpisodes) {
          return false;
        }

        const refreshKey = `${item.mediaType}-${item.id}`;
        if (refreshingItemKeys[refreshKey]) return false;

        const lastMetadataUpdateMs = getTimestampMillis(
          item.newEpisodeStatusCheckedAt,
        );
        const lastAttemptMs = Number(
          autoRefreshAttemptedAtRef.current[refreshKey] || 0,
        );
        const lastCheckedMs = Math.max(lastMetadataUpdateMs, lastAttemptMs);
        return now - lastCheckedMs >= AUTO_METADATA_REFRESH_COOLDOWN_MS;
      })
      .slice(0, AUTO_METADATA_REFRESH_BATCH_SIZE);

    if (!candidates.length) return;

    candidates.forEach((item) => {
      const refreshKey = `${item.mediaType}-${item.id}`;
      autoRefreshAttemptedAtRef.current[refreshKey] = now;
      refreshSavedMetadata(item, { silent: true });
    });
  }, [items, refreshingItemKeys, refreshSavedMetadata, user]);

  const movieItems = sortedVisible.filter((i) => i.mediaType === "movie");
  const showItems = sortedVisible.filter((i) => i.mediaType === "tv");
  const unreleasedMoviesCount = movieItems.filter(isUnreleasedItem).length;
  const unreleasedShowsCount = showItems.filter(isUnreleasedItem).length;
  const releasedMovieItems = movieItems.filter((i) => !isUnreleasedItem(i));
  const unreleasedMovieItems = movieItems.filter((i) => isUnreleasedItem(i));
  const releasedShowItems = showItems.filter((i) => !isUnreleasedItem(i));
  const unreleasedShowItems = showItems.filter((i) => isUnreleasedItem(i));
  const sideMovies = items
    .filter((i) => i.mediaType === "movie" && i.favourite)
    .slice(0, 8);
  const sideShows = items
    .filter((i) => i.mediaType === "tv" && i.favourite)
    .slice(0, 8);
  const actorIdsSet = new Set(actors.map((a) => String(a.id)));
  const ratedActors = Object.entries(actorRatingsById)
    .map(([id, rating]) => {
      const value = Number(rating?.value || 0);
      const favouriteActor = actors.find((a) => String(a.id) === id);
      return {
        id: Number(id),
        name: favouriteActor?.name || rating?.title || `Actor #${id}`,
        image: favouriteActor?.image || rating?.image || null,
        value,
        ratingEmoji: value > 0 ? EMOJI_SCALE[value - 1] : null,
        isFavourite: actorIdsSet.has(String(id)),
        updatedAt: Number(rating?.updatedAt?.seconds || 0),
      };
    })
    .filter((actor) => actor.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return b.updatedAt - a.updatedAt;
    });

  useEffect(() => {
    if (!user?.email) return;

    const missingRatedActorIds = Object.entries(actorRatingsById)
      .filter(([, rating]) => Number(rating?.value || 0) > 0)
      .map(([id, rating]) => ({ id, rating }))
      .filter(({ id, rating }) => {
        const isFavouriteActor = actors.some(
          (a) => String(a.id) === String(id),
        );
        if (isFavouriteActor) return false;
        return !String(rating?.image || "").trim();
      })
      .map(({ id }) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    missingRatedActorIds.forEach(async (id) => {
      const key = String(id);
      if (actorImageHydrationRef.current.has(key)) return;
      actorImageHydrationRef.current.add(key);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/person/${id}`,
          {
            params: { api_key: process.env.REACT_APP_TMDB_API_KEY },
          },
        );
        const data = response.data || {};
        const ratingRef = doc(
          db,
          ...profileRatingItemPath(user.email, activeProfileId, "actors", id),
        );
        await setDoc(
          ratingRef,
          {
            id,
            title:
              data.name || actorRatingsById?.[key]?.title || `Actor #${id}`,
            image: data.profile_path ?? null,
            mediaType: "person",
            mode: "emoji",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        actorImageHydrationRef.current.delete(key);
      }
    });
  }, [actorRatingsById, actors, user?.email, activeProfileId]);
  const ratedActorsOnly = ratedActors.filter((actor) => !actor.isFavourite);
  const actorsViewEmpty =
    mediaFilter === "actors" && actors.length === 0 && ratedActors.length === 0;

  useEffect(() => {
    setPageBySection({});
  }, [mediaFilter, statusFilter, sortFilter, items.length]);

  const setSectionPage = (sectionKey, page) => {
    setPageBySection((prev) => ({
      ...prev,
      [sectionKey]: Math.max(1, page),
    }));
  };

  const renderGrid = (list) => (
    <motion.div
      variants={gridStagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4"
    >
      {list.map((item) => (
        <motion.div
          key={`${item.mediaType}-${item.id}`}
          variants={slideUp}
          whileHover={{ y: -4 }}
          layout
          className="group bg-[#111] rounded-lg overflow-hidden relative"
        >
          {(() => {
            const itemKey = `${item.mediaType}-${item.id}`;
            const posterSrc = item.poster
              ? `https://image.tmdb.org/t/p/w342${item.poster}`
              : "";
            const posterKey = `${itemKey}-${item.poster || "none"}`;
            const posterLoaded = Boolean(loadedPosterKeys[posterKey]);
            const posterFailed = Boolean(failedPosterKeys[posterKey]);
            const isPosterReady = !posterSrc || posterLoaded || posterFailed;
            const totalEpisodes = Number(item.totalEpisodes || 0);
            const watchedEpisodes = Number(item.watchedEpisodes || 0);
            const clampedWatched = Math.max(
              0,
              Math.min(watchedEpisodes, totalEpisodes || watchedEpisodes),
            );
            const progressPercent =
              item.mediaType === "tv" && totalEpisodes > 0
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round((clampedWatched / totalEpisodes) * 100),
                    ),
                  )
                : item.status === "Finished" || item.status === "Watched"
                  ? 100
                  : 0;
            const progressLabel =
              item.mediaType === "tv" && item.status === "Want to Watch"
                ? "Not started yet"
                : item.mediaType === "tv" &&
                    (item.status === "Finished" || item.status === "Watched")
                  ? "Finished Show"
                  : item.mediaType === "tv" &&
                      Number(item.currentSeason || 0) > 0 &&
                      Number(item.currentEpisode || 0) > 0
                    ? `S${item.currentSeason} • E${item.currentEpisode}`
                    : item.mediaType === "tv" && totalEpisodes > 0
                      ? `${clampedWatched}/${totalEpisodes} eps`
                      : null;
            const userRatingValue = Number(item.userRatingValue || 0);
            const unreleasedItem = isUnreleasedItem(item);
            const userRatingLabel = unreleasedItem
              ? "Rating opens on release"
              : userRatingValue > 0
                ? getStarParts(userRatingValue)
                : "Not rated";
            const ratingButtonLabel = unreleasedItem
              ? userRatingLabel
              : userRatingValue > 0
                ? userRatingLabel
                : "Click to rate";
            const refreshKey = `${item.mediaType}-${item.id}`;
            const itemRefreshing = Boolean(refreshingItemKeys[refreshKey]);
            return (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setRemoveConfirm(item)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 hover:bg-red-600/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200"
                  title="Remove from list"
                >
                  <FaTrash size={12} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleFavourite(item)}
                  className={`absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200 ${
                    unreleasedItem
                      ? "bg-black/40 text-white/40 cursor-not-allowed"
                      : item.favourite
                        ? "bg-red-600/90"
                        : "bg-black/60 hover:bg-black/80"
                  }`}
                  title={
                    unreleasedItem
                      ? "Favourites unlock on release"
                      : item.favourite
                        ? "Remove favourite"
                        : "Add favourite"
                  }
                >
                  {item.favourite ? (
                    <FaHeart size={11} />
                  ) : (
                    <FaRegHeart size={11} />
                  )}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => refreshSavedMetadata(item)}
                  disabled={itemRefreshing}
                  className={`absolute top-2 left-[2.55rem] z-10 w-7 h-7 rounded-full flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200 ${
                    itemRefreshing
                      ? "bg-black/50 text-white/70 cursor-not-allowed"
                      : "bg-black/60 hover:bg-black/80"
                  }`}
                  title="Refresh poster and metadata"
                >
                  {itemRefreshing ? (
                    <ImSpinner2 className="animate-spin" size={12} />
                  ) : (
                    <FiRefreshCw size={12} />
                  )}
                </motion.button>
                <div
                  className="relative w-full aspect-[2/3] bg-white/10 cursor-pointer overflow-hidden"
                  onClick={(e) =>
                    openPath(
                      e,
                      item.mediaType === "tv"
                        ? `/shows/${item.id}`
                        : `/movies/${item.id}`,
                    )
                  }
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      openPath(
                        e,
                        item.mediaType === "tv"
                          ? `/shows/${item.id}`
                          : `/movies/${item.id}`,
                      );
                    }
                  }}
                >
                  {!isPosterReady && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  )}
                  {posterSrc && !posterFailed ? (
                    <img
                      src={posterSrc}
                      alt=""
                      onLoad={() => markPosterLoaded(posterKey)}
                      onError={() => markPosterFailed(posterKey)}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                        isPosterReady ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/45">
                      <FiImage size={22} />
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2 min-h-[128px]">
                  <h3
                    className="text-sm font-medium truncate cursor-pointer hover:text-red-400"
                    onClick={(e) =>
                      openPath(
                        e,
                        item.mediaType === "tv"
                          ? `/shows/${item.id}`
                          : `/movies/${item.id}`,
                      )
                    }
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        openPath(
                          e,
                          item.mediaType === "tv"
                            ? `/shows/${item.id}`
                            : `/movies/${item.id}`,
                        );
                      }
                    }}
                  >
                    {item.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => openQuickRate(item)}
                    className={`text-[12px] min-h-[18px] text-left font-medium transition ${
                      unreleasedItem
                        ? "text-white/60 italic hover:text-white/80"
                        : "text-yellow-300 hover:text-yellow-200"
                    }`}
                    title="Quick rate"
                  >
                    My rating:{" "}
                    {unreleasedItem || userRatingValue <= 0 ? (
                      ratingButtonLabel
                    ) : (
                      <span className="inline-flex items-center gap-0.5 align-middle">
                        {Array.from({
                          length: ratingButtonLabel?.full || 0,
                        }).map((_, idx) => (
                          <FaStar key={`full-${idx}`} size={12} />
                        ))}
                        {ratingButtonLabel?.half ? (
                          <FaStarHalfAlt key="half" size={12} />
                        ) : null}
                        {Array.from({
                          length: ratingButtonLabel?.empty || 0,
                        }).map((_, idx) => (
                          <FaRegStar key={`empty-${idx}`} size={12} />
                        ))}
                      </span>
                    )}
                  </button>

                  {item.mediaType === "tv" && (
                    <div
                      onClick={() => {
                        setQuickProgress({
                          item,
                          watched: item.watchedEpisodes || 0,
                          total: item.totalEpisodes || 0,
                        });
                      }}
                      className="space-y-1 cursor-pointer"
                    >
                      <p className="text-[11px] text-white/70">
                        {progressLabel ||
                          (item.status === "Finished" ||
                          item.status === "Watched"
                            ? "Finished Show"
                            : "No episode progress")}
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-red-500 transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center gap-1">
                    {STATUSES.map((s) => (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        key={s.key}
                        onClick={() =>
                          setConfirm({
                            item,
                            nextStatus: s.key,
                          })
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          item.status === s.key
                            ? "bg-red-500 text-white"
                            : "bg-white/10 hover:bg-white/20"
                        }`}
                      >
                        {s.icon}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </motion.div>
      ))}
    </motion.div>
  );

  const renderPaginationControls = (sectionKey, currentPage, totalPages) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-3 mb-5 flex items-center justify-center gap-3">
        <button
          onClick={() => setSectionPage(sectionKey, currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-5 py-2 rounded-md text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-xs text-white/55">
          Page {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setSectionPage(sectionKey, currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-5 py-2 rounded-md text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    );
  };

  const renderPagedGrid = (list, sectionKey) => {
    const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(pageBySection[sectionKey] || 1, totalPages);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = list.slice(start, start + ITEMS_PER_PAGE);

    return (
      <>
        {renderPaginationControls(sectionKey, currentPage, totalPages)}
        {renderGrid(pageItems)}
        {renderPaginationControls(sectionKey, currentPage, totalPages)}
      </>
    );
  };

  const renderPagedActorGrid = (
    list,
    sectionKey,
    { showRemove = false, showRating = false } = {},
  ) => {
    const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(pageBySection[sectionKey] || 1, totalPages);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = list.slice(start, start + ITEMS_PER_PAGE);

    return (
      <>
        {renderPaginationControls(sectionKey, currentPage, totalPages)}
        {renderActorGrid(pageItems, { showRemove, showRating })}
        {renderPaginationControls(sectionKey, currentPage, totalPages)}
      </>
    );
  };

  const renderActorGrid = (
    list,
    { showRemove = false, showRating = false } = {},
  ) => (
    <motion.div
      variants={gridStagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4"
    >
      {list.map((actor) =>
        (() => {
          const actorImageSrc = getActorImageSrc(actor, "w342");
          const actorRatingValue = Number(
            actor.value || actorRatingsById?.[String(actor.id)]?.value || 0,
          );
          const actorReactionLabel =
            actorRatingValue > 0
              ? REACTION_LABELS[actorRatingValue - 1]
              : "Not rated";
          const hoverValue = Number(actorHoverValueById[String(actor.id)] || 0);
          const previewValue = hoverValue > 0 ? hoverValue : actorRatingValue;
          return (
            <motion.div
              key={`actor-${actor.id}`}
              variants={slideUp}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-transparent bg-[#101010] shadow-[0_14px_28px_rgba(0,0,0,0.35)]"
            >
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openActorImageModal(actor)}
                    disabled={
                      savingActorImageId === Number(actor.id) ||
                      refreshingActorImageId === Number(actor.id)
                    }
                    className={`group/btn h-7 min-w-[1.75rem] px-2 rounded-full flex items-center justify-center overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-200 ${
                      savingActorImageId === Number(actor.id) ||
                      refreshingActorImageId === Number(actor.id)
                        ? "bg-black/45 text-white/45 cursor-not-allowed"
                        : "bg-black/60 hover:bg-black/80"
                    }`}
                    title="Custom Image"
                    aria-label={`Set custom image for ${actor.name}`}
                  >
                    {savingActorImageId === Number(actor.id) ? (
                      <ImSpinner2 className="animate-spin" size={12} />
                    ) : (
                      <FiImage size={12} />
                    )}
                    <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] text-white/90 ml-0 group-hover/btn:max-w-[84px] group-hover/btn:opacity-100 group-hover/btn:ml-1 transition-all duration-200">
                      Custom Image
                    </span>
                  </motion.button>
                </div>
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => refreshActorImageFromSource(actor)}
                    disabled={
                      savingActorImageId === Number(actor.id) ||
                      refreshingActorImageId === Number(actor.id)
                    }
                    className={`group/btn h-7 min-w-[1.75rem] px-2 rounded-full flex items-center justify-center overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-200 ${
                      savingActorImageId === Number(actor.id) ||
                      refreshingActorImageId === Number(actor.id)
                        ? "bg-black/45 text-white/45 cursor-not-allowed"
                        : "bg-black/60 hover:bg-black/80"
                    }`}
                    title="Refresh"
                  >
                    {refreshingActorImageId === Number(actor.id) ? (
                      <ImSpinner2 className="animate-spin" size={12} />
                    ) : (
                      <FiRefreshCw size={12} />
                    )}
                    <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] text-white/90 ml-0 group-hover/btn:max-w-[52px] group-hover/btn:opacity-100 group-hover/btn:ml-1 transition-all duration-200">
                      Refresh
                    </span>
                  </motion.button>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    actor.isFavourite
                      ? removeActor(actor)
                      : addActorToFavourites(actor)
                  }
                  className={`group/btn h-7 min-w-[1.75rem] px-2 rounded-full
    flex items-center justify-center overflow-hidden transition-all duration-200
    opacity-0 pointer-events-none
    group-hover:opacity-100 group-hover:pointer-events-auto
    group-focus-within:opacity-100 group-focus-within:pointer-events-auto
    ${
      actor.isFavourite
        ? "bg-red-600 text-white"
        : "bg-black/60 hover:bg-black/80"
    }
    ${
      savingActorImageId === Number(actor.id) ||
      refreshingActorImageId === Number(actor.id)
        ? "bg-black/45 text-white/45 cursor-not-allowed"
        : ""
    }
  `}
                  title={
                    actor.isFavourite
                      ? "Remove from favourites"
                      : "Add to favourites"
                  }
                >
                  {actor.isFavourite ? (
                    <FaHeart size={11} />
                  ) : (
                    <FaRegHeart size={11} />
                  )}
                  <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] text-white/90 ml-0 group-hover/btn:max-w-[52px] group-hover/btn:opacity-100 group-hover/btn:ml-1 transition-all duration-200">
                    Favourite
                  </span>
                </motion.button>
              </div>
              {showRemove && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeActor(actor)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 hover:bg-red-600/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200"
                  title="Remove actor"
                >
                  <FaTrash size={12} />
                </motion.button>
              )}
              <div
                className="relative cursor-pointer aspect-[2/3] overflow-hidden"
                onClick={(e) => openPath(e, `/person/${actor.id}`)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    openPath(e, `/person/${actor.id}`);
                  }
                }}
              >
                <img
                  src={
                    actorImageSrc ||
                    "https://placehold.co/300x450/111111/ffffff?text=Actor"
                  }
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none" />
                <button
                  onClick={(e) => openPath(e, `/person/${actor.id}`)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      openPath(e, `/person/${actor.id}`);
                    }
                  }}
                  className="absolute bottom-3 left-3 right-3 text-[15px] font-semibold tracking-tight text-white text-center truncate hover:text-red-300 transition-colors"
                >
                  {actor.name}
                </button>
              </div>
              {showRating && (
                <div className="px-3 py-2.5 bg-gradient-to-b from-black/75 to-black/90">
                  <div className="flex w-full flex-col items-center justify-center gap-1.5">
                    <div
                      className="flex items-center justify-center gap-1"
                      onMouseLeave={() =>
                        setActorHoverValueById((prev) => ({
                          ...prev,
                          [String(actor.id)]: 0,
                        }))
                      }
                    >
                      {EMOJI_SCALE.map((emoji, idx) => {
                        const value = idx + 1;
                        const active = previewValue === value;
                        const hasSelection = previewValue > 0;
                        return (
                          <button
                            key={`${actor.id}-reaction-${value}`}
                            type="button"
                            onMouseEnter={() =>
                              setActorHoverValueById((prev) => ({
                                ...prev,
                                [String(actor.id)]: value,
                              }))
                            }
                            onFocus={() =>
                              setActorHoverValueById((prev) => ({
                                ...prev,
                                [String(actor.id)]: value,
                              }))
                            }
                            onClick={() => saveActorRating(actor, value)}
                            className={`leading-none transition-all duration-150 ${
                              active
                                ? "opacity-100 scale-125"
                                : hasSelection
                                  ? "opacity-30 scale-90"
                                  : "opacity-80 hover:opacity-100 hover:scale-110"
                            }`}
                            aria-label={`Set ${actor.name} reaction ${value}`}
                          >
                            <span className="text-base">{emoji}</span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/65">
                      {previewValue > 0
                        ? REACTION_LABELS[previewValue - 1]
                        : actorReactionLabel}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })(),
      )}
    </motion.div>
  );

  return (
    <motion.div
      variants={fade}
      initial="hidden"
      animate="show"
      className="h-screen bg-[#0a0a0a] text-white flex"
    >
      {/* MAIN COLUMN */}
      <div className="flex-1 flex flex-col overflow-hidden pt-16">
        {/* HEADER */}
        <header className="px-6 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            {/* Context label */}
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest text-white/40">
                Library
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-sm text-white/70">
                {user.displayName}'s Watchlist
              </span>
            </div>
          </div>

          {/* MEDIA FILTER */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {["all", "movie", "tv", "actors"].map((t) => (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={t}
                onClick={() => setMediaFilter(t)}
                className={`px-4 py-1.5 rounded-full text-sm ${
                  mediaFilter === t
                    ? "bg-red-500 text-white shadow-[0_0_0_1px_rgba(239,68,68,0.6)]"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {t === "all"
                  ? "All"
                  : t === "movie"
                    ? "Movies"
                    : t === "tv"
                      ? "Shows"
                      : "Actors"}
              </motion.button>
            ))}
          </div>
        </header>

        {/* STATUS FILTER */}
        {mediaFilter !== "actors" && (
          <div className="flex flex-col items-center justify-center px-6 py-3 border-b border-white/10 gap-2 overflow-x-auto">
            <div className="flex items-center justify-center">
              <span
                className="
                  px-2.5 py-1 rounded-full
                  text-[10px] uppercase tracking-wider
                  bg-white/5 text-white/50
                "
              >
                Status
              </span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  statusFilter === "all"
                    ? "bg-white text-black"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                All
              </motion.button>

              {STATUSES.map((s) => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-2 ${
                    statusFilter === s.key
                      ? "bg-white text-black"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {s.icon}
                  {s.key}
                </motion.button>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <span
                className="
                    px-2.5 py-1 rounded-full
                    text-[10px] uppercase tracking-wider
                    bg-white/5 text-white/50
                  "
              >
                Sort
              </span>
              {[
                { key: "recent", label: "Recent" },
                { key: "highest_rated", label: "Highest Rated" },
                { key: "favourites", label: "Favourites" },
                { key: "title_az", label: "Title A-Z" },
              ].map((opt) => (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  key={opt.key}
                  onClick={() => setSortFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    sortFilter === opt.key
                      ? "bg-red-500 text-white"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={clearFilters}
              className="
              px-3 py-1.5 rounded-full text-sm
              border-2 border-red-600
              bg-white/5 text-white/50
              hover:bg-red-600 hover:text-white
              hover:border-white/60
              transition
              "
              title="Reset filters"
            >
              Reset Saved Preferences
            </motion.button>
          </div>
        )}

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="watchlist-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {(mediaFilter === "all" || mediaFilter === "movie") && (
                  <section className="space-y-4">
                    <h2 className="text-sm uppercase tracking-widest text-white/50">
                      Movies &gt;
                    </h2>
                    <SkeletonGrid />
                  </section>
                )}
                {(mediaFilter === "all" || mediaFilter === "tv") && (
                  <section className="space-y-4">
                    <h2 className="text-sm uppercase tracking-widest text-white/50">
                      Shows &gt;
                    </h2>
                    <SkeletonGrid />
                  </section>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="watchlist-content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {visible.length === 0 && mediaFilter !== "actors" && (
                  <motion.p
                    variants={slideUp}
                    initial="hidden"
                    animate="show"
                    className="text-white/40 text-center py-20"
                  >
                    Nothing here yet.
                  </motion.p>
                )}
                {actorsViewEmpty && (
                  <motion.p
                    variants={slideUp}
                    initial="hidden"
                    animate="show"
                    className="text-white/40 text-center py-20"
                  >
                    No actors yet.
                  </motion.p>
                )}

                {(mediaFilter === "all" || mediaFilter === "movie") && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm uppercase tracking-widest text-white/50">
                        Movies &gt;
                      </h2>
                      {unreleasedMoviesCount > 0 && (
                        <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/50">
                          {unreleasedMoviesCount} unreleased
                        </span>
                      )}
                    </div>
                    {movieItems.length ? (
                      statusFilter === "Want to Watch" ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <button
                              onClick={() =>
                                setWantWatchSections((prev) => ({
                                  ...prev,
                                  movieReleased: !prev.movieReleased,
                                }))
                              }
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs uppercase tracking-wide text-white/60">
                                Released
                              </span>
                              <span className="text-xs text-white/45">
                                {releasedMovieItems.length}{" "}
                                {wantWatchSections.movieReleased ? "▾" : "▸"}
                              </span>
                            </button>
                            {wantWatchSections.movieReleased &&
                              (releasedMovieItems.length ? (
                                <div className="mt-3">
                                  {renderPagedGrid(
                                    releasedMovieItems,
                                    "movieReleased",
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-white/40">
                                  No released movies in want to watch.
                                </p>
                              ))}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <button
                              onClick={() =>
                                setWantWatchSections((prev) => ({
                                  ...prev,
                                  movieUnreleased: !prev.movieUnreleased,
                                }))
                              }
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs uppercase tracking-wide text-white/60">
                                Unreleased
                              </span>
                              <span className="text-xs text-white/45">
                                {unreleasedMovieItems.length}{" "}
                                {wantWatchSections.movieUnreleased ? "▾" : "▸"}
                              </span>
                            </button>
                            {wantWatchSections.movieUnreleased &&
                              (unreleasedMovieItems.length ? (
                                <div className="mt-3">
                                  {renderPagedGrid(
                                    unreleasedMovieItems,
                                    "movieUnreleased",
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-white/40">
                                  No unreleased movies in want to watch.
                                </p>
                              ))}
                          </div>
                        </div>
                      ) : (
                        renderPagedGrid(movieItems, "movieAll")
                      )
                    ) : (
                      <p className="text-xs text-white/40">No movies found.</p>
                    )}
                  </section>
                )}

                {(mediaFilter === "all" || mediaFilter === "tv") && (
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm uppercase tracking-widest text-white/50">
                        Shows &gt;
                      </h2>
                      {unreleasedShowsCount > 0 && (
                        <span className="text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/50">
                          {unreleasedShowsCount} unreleased
                        </span>
                      )}
                    </div>
                    {showItems.length ? (
                      statusFilter === "Want to Watch" ? (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <button
                              onClick={() =>
                                setWantWatchSections((prev) => ({
                                  ...prev,
                                  tvReleased: !prev.tvReleased,
                                }))
                              }
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs uppercase tracking-wide text-white/60">
                                Released
                              </span>
                              <span className="text-xs text-white/45">
                                {releasedShowItems.length}{" "}
                                {wantWatchSections.tvReleased ? "▾" : "▸"}
                              </span>
                            </button>
                            {wantWatchSections.tvReleased &&
                              (releasedShowItems.length ? (
                                <div className="mt-3">
                                  {renderPagedGrid(
                                    releasedShowItems,
                                    "showReleased",
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-white/40">
                                  No released shows in want to watch.
                                </p>
                              ))}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                            <button
                              onClick={() =>
                                setWantWatchSections((prev) => ({
                                  ...prev,
                                  tvUnreleased: !prev.tvUnreleased,
                                }))
                              }
                              className="w-full flex items-center justify-between text-left"
                            >
                              <span className="text-xs uppercase tracking-wide text-white/60">
                                Unreleased
                              </span>
                              <span className="text-xs text-white/45">
                                {unreleasedShowItems.length}{" "}
                                {wantWatchSections.tvUnreleased ? "▾" : "▸"}
                              </span>
                            </button>
                            {wantWatchSections.tvUnreleased &&
                              (unreleasedShowItems.length ? (
                                <div className="mt-3">
                                  {renderPagedGrid(
                                    unreleasedShowItems,
                                    "showUnreleased",
                                  )}
                                </div>
                              ) : (
                                <p className="mt-3 text-xs text-white/40">
                                  No unreleased shows in want to watch.
                                </p>
                              ))}
                          </div>
                        </div>
                      ) : (
                        renderPagedGrid(showItems, "showAll")
                      )
                    ) : (
                      <p className="text-xs text-white/40">No shows found.</p>
                    )}
                  </section>
                )}
                {mediaFilter === "actors" && (
                  <>
                    <section className="space-y-4">
                      <h2 className="text-sm uppercase tracking-widest text-white/50">
                        Favourite Actors &gt;
                      </h2>
                      {actors.length ? (
                        renderActorGrid(
                          actors.map((a) => ({ ...a, isFavourite: true })),
                          { showRemove: true, showRating: true },
                        )
                      ) : (
                        <p className="text-xs text-white/40">
                          No favourite actors found.
                        </p>
                      )}
                    </section>
                    <section className="space-y-4">
                      <h2 className="text-sm uppercase tracking-widest text-white/50">
                        Rated Actors &gt;
                      </h2>
                      {ratedActorsOnly.length ? (
                        renderPagedActorGrid(ratedActorsOnly, "ratedActors", {
                          showRating: true,
                        })
                      ) : (
                        <p className="text-xs text-white/40">
                          No additional rated actors found.
                        </p>
                      )}
                    </section>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* SIDE PANEL */}
      <SidePanel
        actors={actors}
        actorRatingsById={actorRatingsById}
        movies={sideMovies}
        shows={sideShows}
        actorsLoading={!sidePanelReady.actors}
        moviesLoading={!sidePanelReady.movies}
        showsLoading={!sidePanelReady.shows}
        onOpenPath={openPath}
        onRemoveActor={removeActor}
        getActorImageSrc={getActorImageSrc}
      />

      <ConfirmModal
        open={!!confirm}
        item={confirm?.item}
        nextStatus={confirm?.nextStatus}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          updateStatus(confirm.item, confirm.nextStatus);
          setConfirm(null);
        }}
      />

      <RemoveConfirmModal
        open={!!removeConfirm}
        item={removeConfirm}
        onCancel={() => setRemoveConfirm(null)}
        onConfirm={async () => {
          await removeFromList(removeConfirm);
          setRemoveConfirm(null);
        }}
      />

      <QuickRateModal
        open={!!quickRate}
        item={quickRate?.item}
        value={quickRate?.value || 0}
        disabled={!!quickRate?.item && isUnreleasedItem(quickRate.item)}
        onRate={(nextValue) => {
          const normalized = Math.max(0, Math.min(5, Number(nextValue) || 0));
          setQuickRate((prev) =>
            prev
              ? {
                  ...prev,
                  value: normalized,
                }
              : prev,
          );
          saveQuickRate(normalized);
        }}
        onClose={closeQuickRate}
        saving={savingQuickRate}
      />

      <QuickProgressModal
        open={!!quickProgress}
        item={quickProgress?.item}
        watched={quickProgress?.watched}
        total={quickProgress?.total}
        saving={savingProgress}
        onChange={(value) => {
          saveProgress(quickProgress.item, value);
        }}
        onClose={() => setQuickProgress(null)}
      />

      <ActorImageSourceModal
        open={actorImageModal.open}
        actor={actorImageModal.actor}
        canRemove={actorHasCustomImage}
        pendingRemove={pendingActorImageRemoval}
        mode={actorImageMode}
        onModeChange={(nextMode) => {
          setActorImageMode(nextMode);
          setActorImageLinkPreviewError(false);
          setPendingActorImageRemoval(false);
        }}
        linkValue={actorImageLinkValue}
        linkValid={actorImageLinkValid}
        previewError={actorImageLinkPreviewError}
        uploadPreview={actorImageUploadPreview}
        uploadFileName={actorImageUploadFileName}
        saving={savingActorImageId === Number(actorImageModal.actor?.id)}
        onLinkChange={(nextValue) => {
          setActorImageLinkValue(nextValue);
          setActorImageLinkPreviewError(false);
          setPendingActorImageRemoval(false);
        }}
        onUploadPick={onActorImageUploadPicked}
        onPreviewError={() => setActorImageLinkPreviewError(true)}
        onClose={closeActorImageModal}
        onSave={saveActorImageFromModal}
        onRemove={queueActorImageRemovalFromModal}
      />

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

export default Account;
