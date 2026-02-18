import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { useNavigate } from "react-router-dom";
import {
  profileSavedCollectionPath,
  resolveProfileId,
} from "../../utils/profileFirestorePaths";

const ContinueWatchingRow = ({ mediaFilter = "all" }) => {
  const { user, loading } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const [items, setItems] = useState([]);
  const navigate = useNavigate();
  const activeProfileId = resolveProfileId(selectedProfile);

  useEffect(() => {
    if (loading || profileLoading || !user?.email) return;
    const movieRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showRef = collection(
      db,
      ...profileSavedCollectionPath(user.email, activeProfileId, "shows"),
    );

    const qMovies = query(movieRef, where("status", "==", "Watching"));
    const qShows = query(showRef, where("status", "==", "Watching"));

    const shouldIncludeMovies = mediaFilter === "all" || mediaFilter === "movie";
    const shouldIncludeShows = mediaFilter === "all" || mediaFilter === "tv";

    let movies = [];
    let shows = [];

    const sync = () => {
      const merged = [...movies, ...shows].sort(
        (a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0),
      );
      setItems(merged);
    };

    const unsubMovies = shouldIncludeMovies
      ? onSnapshot(
          qMovies,
          (snap) => {
            movies = snap.docs.map((d) => ({
              id: d.id,
              mediaType: "movie",
              ...d.data(),
            }));
            sync();
          },
          (err) => {
            console.error("CW movies snapshot error:", err);
          },
        )
      : () => {};

    const unsubShows = shouldIncludeShows
      ? onSnapshot(
          qShows,
          (snap) => {
            shows = snap.docs.map((d) => ({
              id: d.id,
              mediaType: "tv",
              ...d.data(),
            }));
            sync();
          },
          (err) => {
            console.error("CW shows snapshot error:", err);
          },
        )
      : () => {};

    return () => {
      unsubMovies();
      unsubShows();
    };
  }, [user, loading, mediaFilter, activeProfileId, profileLoading]);

  if (loading || !items.length) return null;

  return (
    <section className="px-10 mb-10">
      <h2 className="text-lg font-semibold mb-4 tracking-wide">
        Continue Watching
      </h2>

      <div className="flex gap-4 overflow-x-scroll scrollbar-hide">
        {items.map((item) => {
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
              : item.status === "Watched"
                ? 100
                : 45;
          const progressPercent = Math.max(4, Math.min(computedProgress, 100));
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
            <button
              key={`${item.mediaType}-${item.id}`}
              onClick={() =>
                navigate(
                  item.mediaType === "tv"
                    ? `/shows/${item.id}`
                    : `/movies/${item.id}`,
                )
              }
              className="
                relative
                w-[260px] h-[145px]
                rounded-xl overflow-hidden
                bg-neutral-900
                group
                transition-all duration-300
                hover:scale-[1.04]
                hover:z-10
              "
            >
              {/* IMAGE */}
              {image ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500/${image}`}
                  alt={item.title || item.name}
                  className="
                    absolute inset-0
                    w-full h-full
                    object-cover
                    transition-transform duration-500
                    group-hover:scale-110
                  "
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20">
                  ▶
                </div>
              )}

              {/* GRADIENT */}
              <div
                className="
                  absolute inset-0
                  bg-gradient-to-t
                  from-black/90 via-black/40 to-transparent
                  opacity-0
                  group-hover:opacity-100
                  transition-opacity duration-300
                "
              />

              {/* TEXT */}
              <div
                className="
                  absolute bottom-3 left-3 right-3
                  text-left
                  opacity-0
                  group-hover:opacity-100
                  transition-opacity duration-300
                "
              >
                <p className="text-sm font-semibold leading-tight line-clamp-2">
                  {item.title || item.name}
                </p>

                <p className="text-[11px] text-neutral-300 mt-0.5">
                  {progressLabel}
                </p>
              </div>

              {/* PROGRESS BAR */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                <div
                  className="h-full bg-red-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
