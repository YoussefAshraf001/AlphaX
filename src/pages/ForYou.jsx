import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { collection, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";

import HeroRail from "../components/browse/HeroRail";
import ContentRow from "../components/browse/ContentRow";
import requests from "../Requests";
import ContinueWatchingRow from "../components/browse/ContinueWatchingRow";
import { useSavedContent } from "../context/SavedContentContext";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { db } from "../firebase";
import {
  profileLikedActorsCollectionPath,
  profileRatingsCollectionPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const MOVIE_GENRES = [
  { id: 27, title: "Because You Like Horror Movies", fetchURL: requests.movies.genres.horror },
  { id: 9648, title: "Because You Like Mystery Movies", fetchURL: requests.movies.genres.mystery },
  { id: 16, title: "Because You Like Animation Movies", fetchURL: requests.movies.genres.animation },
  { id: 12, title: "Because You Like Adventure Movies", fetchURL: requests.movies.genres.adventure },
  { id: 35, title: "Because You Like Comedy Movies", fetchURL: requests.movies.genres.comedy },
  { id: 36, title: "Because You Like History Movies", fetchURL: requests.movies.genres.history },
  { id: 878, title: "Because You Like Sci-Fi Movies", fetchURL: requests.movies.genres.sciFi },
  { id: 53, title: "Because You Like Thriller Movies", fetchURL: requests.movies.genres.thriller },
  { id: 10749, title: "Because You Like Romance Movies", fetchURL: requests.movies.genres.romance },
  { id: 10752, title: "Because You Like War Movies", fetchURL: requests.movies.genres.war },
];

const TV_GENRES = [
  { id: 35, title: "Because You Like Comedy Series", fetchURL: requests.tv.genres.comedy },
  { id: 18, title: "Because You Like Drama Series", fetchURL: requests.tv.genres.drama },
  { id: 10759, title: "Because You Like Action & Adventure Series", fetchURL: requests.tv.genres.actionAdventure },
  { id: 16, title: "Because You Like Animation Series", fetchURL: requests.tv.genres.animation },
  { id: 80, title: "Because You Like Crime Series", fetchURL: requests.tv.genres.crime },
  { id: 9648, title: "Because You Like Mystery Series", fetchURL: requests.tv.genres.mystery },
  { id: 10765, title: "Because You Like Sci-Fi & Fantasy Series", fetchURL: requests.tv.genres.sciFiFantasy },
  { id: 99, title: "Because You Like Documentary Series", fetchURL: requests.tv.genres.documentary },
];

const scoreItemWeight = (item) => {
  const ratingValue = Number(item.value || 0);
  const ratingWeight = Math.min(2, ratingValue / 2);
  const favouriteWeight = item.favourite ? 1.6 : 0;
  const statusWeight =
    item.status === "Watched" ? 1.1 : item.status === "Watching" ? 0.8 : 0;
  return 1 + ratingWeight + favouriteWeight + statusWeight;
};

const stripBecausePrefix = (title) =>
  String(title || "")
    .replace(/^Because You Like\s*/i, "")
    .replace(/\s+(Movies|Series)$/i, "")
    .trim();

const ForYou = () => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const { savedItems } = useSavedContent();
  const [ratedItems, setRatedItems] = useState([]);
  const [favouriteActors, setFavouriteActors] = useState([]);
  const [actorRatingsMap, setActorRatingsMap] = useState({});
  const [actorRecommendationRows, setActorRecommendationRows] = useState([]);
  const [movieRows, setMovieRows] = useState([]);
  const [tvRows, setTvRows] = useState([]);
  const [loadingPersonalization, setLoadingPersonalization] = useState(false);
  const [heroTab, setHeroTab] = useState("movies");
  const activeProfileId = resolveProfileId(selectedProfile);

  useEffect(() => {
    if (!user?.email) {
      setRatedItems([]);
      return;
    }

    const movieRatingsRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "movies"),
    );
    const showRatingsRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "shows"),
    );

    let movieRatings = [];
    let showRatings = [];

    const sync = () => {
      setRatedItems([...movieRatings, ...showRatings]);
    };

    const unsubMovies = onSnapshot(movieRatingsRef, (snap) => {
      movieRatings = snap.docs.map((d) => ({
        ...d.data(),
        id: Number(d.data()?.id || d.id),
        mediaType: "movie",
      }));
      sync();
    });

    const unsubShows = onSnapshot(showRatingsRef, (snap) => {
      showRatings = snap.docs.map((d) => ({
        ...d.data(),
        id: Number(d.data()?.id || d.id),
        mediaType: "tv",
      }));
      sync();
    });

    return () => {
      unsubMovies();
      unsubShows();
    };
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    if (!user?.email) {
      setFavouriteActors([]);
      return;
    }

    const actorsRef = collection(
      db,
      ...profileLikedActorsCollectionPath(user.email, activeProfileId),
    );
    const unsub = onSnapshot(actorsRef, (snap) => {
      const next = snap.docs
        .map((d) => d.data())
        .sort(
          (a, b) =>
            Number(b?.updatedAt?.seconds || 0) - Number(a?.updatedAt?.seconds || 0),
        );
      setFavouriteActors(next);
    });

    return () => unsub();
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    if (!user?.email) {
      setActorRatingsMap({});
      return;
    }

    const actorRatingsRef = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "actors"),
    );

    const unsub = onSnapshot(actorRatingsRef, (snap) => {
      const next = {};
      snap.docs.forEach((d) => {
        const data = d.data() || {};
        next[String(data.id ?? d.id)] = data;
      });
      setActorRatingsMap(next);
    });

    return () => unsub();
  }, [user?.email, activeProfileId]);

  const profileSeed = useMemo(() => {
    const combined = [...savedItems, ...ratedItems].filter(
      (item) => Number(item?.id) > 0 && (item.mediaType === "movie" || item.mediaType === "tv"),
    );
    const map = new Map();
    combined.forEach((item) => {
      const key = `${item.mediaType}:${item.id}`;
      const prev = map.get(key) || {};
      map.set(key, { ...prev, ...item });
    });
    return Array.from(map.values()).slice(0, 24);
  }, [savedItems, ratedItems]);

  const seedKey = useMemo(
    () =>
      profileSeed
        .map(
          (item) =>
            `${item.mediaType}:${item.id}:${item.status || ""}:${item.favourite ? 1 : 0}:${item.value || 0}`,
        )
        .join("|"),
    [profileSeed],
  );

  useEffect(() => {
    let cancelled = false;

    const buildPersonalizedRows = async () => {
      if (!profileSeed.length) {
        setMovieRows([]);
        setTvRows([]);
        return;
      }

      setLoadingPersonalization(true);
      try {
        const requestsList = profileSeed.map((item) => {
          const path = item.mediaType === "tv" ? "tv" : "movie";
          return axios.get(
            `https://api.themoviedb.org/3/${path}/${item.id}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          );
        });

        const responses = await Promise.allSettled(requestsList);
        if (cancelled) return;

        const movieScores = new Map();
        const tvScores = new Map();

        responses.forEach((result, index) => {
          if (result.status !== "fulfilled") return;

          const seed = profileSeed[index];
          const genres = Array.isArray(result.value?.data?.genres)
            ? result.value.data.genres
            : [];
          const weight = scoreItemWeight(seed);

          genres.forEach((genre) => {
            if (!genre?.id) return;
            if (seed.mediaType === "movie") {
              movieScores.set(genre.id, (movieScores.get(genre.id) || 0) + weight);
            } else {
              tvScores.set(genre.id, (tvScores.get(genre.id) || 0) + weight);
            }
          });
        });

        const selectTopRows = (config, scores, limit = 3) =>
          [...config]
            .map((entry) => ({ ...entry, score: scores.get(entry.id) || 0 }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        setMovieRows(selectTopRows(MOVIE_GENRES, movieScores));
        setTvRows(selectTopRows(TV_GENRES, tvScores));
      } catch {
        if (cancelled) return;
        setMovieRows([]);
        setTvRows([]);
      } finally {
        if (!cancelled) setLoadingPersonalization(false);
      }
    };

    buildPersonalizedRows();
    return () => {
      cancelled = true;
    };
  }, [seedKey, profileSeed]);

  useEffect(() => {
    if (!favouriteActors.length) {
      setActorRecommendationRows([]);
      return;
    }

    const topActors = [...favouriteActors]
      .sort((a, b) => {
        const ratingA = Number(actorRatingsMap[String(a.id)]?.value || 0);
        const ratingB = Number(actorRatingsMap[String(b.id)]?.value || 0);
        if (ratingB !== ratingA) return ratingB - ratingA;

        const updatedA = Number(a?.updatedAt?.seconds || 0);
        const updatedB = Number(b?.updatedAt?.seconds || 0);
        return updatedB - updatedA;
      })
      .slice(0, 5);

    const rows = topActors.map((actor) => ({
      actor,
      fetchURL: `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.REACT_APP_TMDB_API_KEY}&sort_by=popularity.desc&with_cast=${actor.id}&include_adult=false&include_video=false&page=1`,
    }));
    setActorRecommendationRows(rows);
  }, [favouriteActors, actorRatingsMap]);

  const topFavouriteActor = useMemo(() => {
    if (!favouriteActors.length) return null;
    return [...favouriteActors].sort((a, b) => {
      const ratingA = Number(actorRatingsMap[String(a.id)]?.value || 0);
      const ratingB = Number(actorRatingsMap[String(b.id)]?.value || 0);
      if (ratingB !== ratingA) return ratingB - ratingA;
      const updatedA = Number(a?.updatedAt?.seconds || 0);
      const updatedB = Number(b?.updatedAt?.seconds || 0);
      return updatedB - updatedA;
    })[0];
  }, [favouriteActors, actorRatingsMap]);

  const actorHeroEndpoint = topFavouriteActor?.id
    ? `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.REACT_APP_TMDB_API_KEY}&sort_by=popularity.desc&with_cast=${topFavouriteActor.id}&include_adult=false&include_video=false&page=1`
    : null;

  useEffect(() => {
    if (!topFavouriteActor && heroTab === "actors") {
      setHeroTab("movies");
    }
  }, [topFavouriteActor, heroTab]);

  const heroEndpoint =
    heroTab === "actors" && actorHeroEndpoint
      ? actorHeroEndpoint
      : movieRows[0]?.fetchURL || tvRows[0]?.fetchURL || requests.movies.trending;
  const tasteChips = useMemo(
    () => [...movieRows, ...tvRows].map((row) => stripBecausePrefix(row.title)),
    [movieRows, tvRows],
  );
  const savedCount = savedItems.length;
  const ratedCount = ratedItems.filter((item) => Number(item?.value || 0) > 0).length;
  const personalizedCount = movieRows.length + tvRows.length;

  return (
    <div className="pt-20 bg-[#0b0b0b] min-h-screen text-white pb-32">
      <HeroRail poolEndpoint={heroEndpoint} />

      <ContinueWatchingRow mediaFilter="all" />

      <div className="px-10 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#18090b] via-[#0b0b0b] to-[#130709] p-5 md:p-6"
        >
          <motion.div
            className="absolute -top-16 -left-16 h-52 w-52 rounded-full bg-red-600/20 blur-3xl"
            animate={{ x: [0, 18, 0], y: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-red-500/15 blur-3xl"
            animate={{ x: [0, -15, 0], y: [0, -8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-red-300/70">
                  Personalized
                </p>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  For You
                </h1>
                <p className="text-sm text-white/70 mt-1">
                  Tailored from what you save, favourite, rate, and finish.
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-full border border-white/15 bg-black/35">
                  <button
                    onClick={() => setHeroTab("movies")}
                    className={`px-3 py-1 rounded-full text-xs transition ${
                      heroTab === "movies"
                        ? "bg-red-600 text-white shadow-[0_0_16px_rgba(229,9,20,0.45)]"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setHeroTab("actors")}
                    disabled={!topFavouriteActor}
                    className={`px-3 py-1 rounded-full text-xs transition ${
                      heroTab === "actors"
                        ? "bg-red-600 text-white shadow-[0_0_16px_rgba(229,9,20,0.45)]"
                        : "text-white/70 hover:text-white"
                    } disabled:opacity-45 disabled:cursor-not-allowed`}
                    title={
                      topFavouriteActor
                        ? `From favorite actor: ${topFavouriteActor.name}`
                        : "Favorite an actor to unlock this tab"
                    }
                  >
                    Favorite Actors
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-white/75">
                    Saved {savedCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-white/75">
                    Rated {ratedCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-full border border-red-400/35 bg-red-500/15 text-red-100">
                    Rows {personalizedCount || 3}
                  </span>
                </div>
              </div>
            </div>

            {tasteChips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tasteChips.map((chip, idx) => (
                  <motion.span
                    key={`${chip}-${idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    className="px-3 py-1 rounded-full text-xs border border-white/15 bg-black/35 text-white/80"
                  >
                    {chip}
                  </motion.span>
                ))}
              </div>
            )}
            {heroTab === "actors" && topFavouriteActor && (
              <p className="mt-3 text-xs text-red-100/80">
                Hero picks tuned from your favorite actor:{" "}
                <span className="text-red-300 font-semibold">
                  {topFavouriteActor.name}
                </span>
              </p>
            )}
          </div>
        </motion.section>

        {loadingPersonalization && (
          <p className="text-sm text-white/50">Learning your taste...</p>
        )}

        {movieRows.map((row) => (
          <ContentRow
            key={`movie-genre-${row.id}`}
            title={row.title}
            fetchURL={row.fetchURL}
            savedItems={savedItems}
          />
        ))}

        {tvRows.map((row) => (
          <ContentRow
            key={`tv-genre-${row.id}`}
            title={row.title}
            fetchURL={row.fetchURL}
            savedItems={savedItems}
          />
        ))}

        {actorRecommendationRows.map((row) => (
          <ContentRow
            key={`actor-row-${row.actor.id}`}
            title={`Because you like ${row.actor.name}`}
            fetchURL={row.fetchURL}
            savedItems={savedItems}
          />
        ))}

        {!loadingPersonalization && movieRows.length === 0 && tvRows.length === 0 && (
          <>
            <ContentRow
              title="Trending This Week"
              fetchURL={requests.movies.trending}
              savedItems={savedItems}
            />
            <ContentRow
              title="Popular Movies"
              fetchURL={requests.movies.popular}
              savedItems={savedItems}
            />
            <ContentRow
              title="Popular Series"
              fetchURL={requests.tv.popular}
              savedItems={savedItems}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ForYou;
