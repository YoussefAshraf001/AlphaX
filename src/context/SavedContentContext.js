import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { UserAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";
import {
  legacySavedCollectionPath,
  profileDocPath,
  profileSavedCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const SavedContentContext = createContext(null);
const normalizeSavedStatus = (status) =>
  status === "Watched" ? "Finished" : status;
const AUTO_EPISODE_STATUS_SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTO_EPISODE_STATUS_SYNC_BATCH_SIZE = 2;

const getTimestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") {
    return Number(value.toMillis()) || 0;
  }
  if (Number.isFinite(Number(value.seconds))) {
    return Number(value.seconds) * 1000;
  }
  return 0;
};

const getReleasedEpisodeTotal = (show) => {
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
  const lastAiredEpisodeNumber = Number(show.last_episode_to_air?.episode_number);
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

export const SavedContentProvider = ({ children }) => {
  const { user } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const [savedItems, setSavedItems] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const activeProfileId = resolveProfileId(selectedProfile);
  const autoStatusSyncInFlightRef = useRef({});
  const autoStatusSyncAttemptedAtRef = useRef({});

  useEffect(() => {
    if (!user?.email || profileLoading) {
      setSavedItems([]);
      setLoadingSaved(true);
      return undefined;
    }

    let unsubMovies = () => {};
    let unsubShows = () => {};
    let cancelled = false;

    const email = user.email;
    const profileId = activeProfileId;

    const bootstrapSavedContentForProfile = async () => {
      setLoadingSaved(true);

      const profileRef = doc(db, ...profileDocPath(email, profileId));
      const profileMeta = await getDoc(profileRef);
      const alreadyMigrated = Boolean(profileMeta.data()?.savedContentMigratedAt);

      if (!alreadyMigrated) {
        const [profileMoviesSnap, profileShowsSnap] = await Promise.all([
          getDocs(collection(db, ...profileSavedCollectionPath(email, profileId, "movies"))),
          getDocs(collection(db, ...profileSavedCollectionPath(email, profileId, "shows"))),
        ]);

        if (profileMoviesSnap.empty && profileShowsSnap.empty) {
          const shouldMigrateLegacyIntoThisProfile = profileId === "main";
          if (!shouldMigrateLegacyIntoThisProfile) {
            await setDoc(
              profileRef,
              {
                id: profileId,
                savedContentMigratedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          } else {
            const [legacyMoviesSnap, legacyShowsSnap] = await Promise.all([
              getDocs(collection(db, ...legacySavedCollectionPath(email, "movies"))),
              getDocs(collection(db, ...legacySavedCollectionPath(email, "shows"))),
            ]);

            if (!legacyMoviesSnap.empty || !legacyShowsSnap.empty) {
              const batch = writeBatch(db);
              legacyMoviesSnap.docs.forEach((snap) => {
                batch.set(
                  doc(db, ...profileSavedItemPath(email, profileId, "movies", snap.id)),
                  snap.data(),
                  { merge: true },
                );
              });
              legacyShowsSnap.docs.forEach((snap) => {
                batch.set(
                  doc(db, ...profileSavedItemPath(email, profileId, "shows", snap.id)),
                  snap.data(),
                  { merge: true },
                );
              });
              batch.set(
                profileRef,
                {
                  id: profileId,
                  savedContentMigratedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
              await batch.commit();
            } else {
              await setDoc(
                profileRef,
                {
                  id: profileId,
                  savedContentMigratedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true },
              );
            }
          }
        } else {
          await setDoc(
            profileRef,
            {
              id: profileId,
              savedContentMigratedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      }

      if (cancelled) return;

      const moviesRef = collection(
        db,
        ...profileSavedCollectionPath(email, profileId, "movies"),
      );
      const showsRef = collection(
        db,
        ...profileSavedCollectionPath(email, profileId, "shows"),
      );

      let movies = [];
      let shows = [];
      let moviesLoaded = false;
      let showsLoaded = false;

      const sync = () => {
        if (!moviesLoaded || !showsLoaded) return;
        setSavedItems([...movies, ...shows]);
        setLoadingSaved(false);
      };

      unsubMovies = onSnapshot(moviesRef, (snap) => {
        movies = snap.docs.map((d) => {
          const data = d.data() || {};
          const normalizedStatus = normalizeSavedStatus(data.status);
          return {
            ...data,
            status: normalizedStatus,
            id: Number(d.id),
            mediaType: "movie",
          };
        });
        moviesLoaded = true;
        sync();
      });

      unsubShows = onSnapshot(showsRef, (snap) => {
        shows = snap.docs.map((d) => {
          const data = d.data() || {};
          const normalizedStatus = normalizeSavedStatus(data.status);
          return {
            ...data,
            status: normalizedStatus,
            id: Number(d.id),
            mediaType: "tv",
          };
        });
        showsLoaded = true;
        sync();
      });
    };

    bootstrapSavedContentForProfile().catch(() => {
      if (!cancelled) {
        setSavedItems([]);
        setLoadingSaved(false);
      }
    });

    return () => {
      cancelled = true;
      unsubMovies();
      unsubShows();
    };
  }, [user?.email, activeProfileId, profileLoading]);

  useEffect(() => {
    if (!user?.email || loadingSaved || !savedItems.length) return;
    const apiKey = process.env.REACT_APP_TMDB_API_KEY;
    if (!apiKey) return;

    const now = Date.now();
    const candidates = savedItems
      .filter((item) => item.mediaType === "tv" && item.status === "Finished")
      .filter((item) => {
        const trackedEpisodes = Number(item.totalEpisodes || 0);
        const watchedEpisodes = Number(item.watchedEpisodes || 0);
        if (trackedEpisodes <= 0 || watchedEpisodes < trackedEpisodes) {
          return false;
        }

        const syncKey = `tv-${item.id}`;
        if (autoStatusSyncInFlightRef.current[syncKey]) return false;

        const lastCheckedMs = Math.max(
          getTimestampMillis(item.newEpisodeStatusCheckedAt),
          Number(autoStatusSyncAttemptedAtRef.current[syncKey] || 0),
        );
        return now - lastCheckedMs >= AUTO_EPISODE_STATUS_SYNC_COOLDOWN_MS;
      })
      .slice(0, AUTO_EPISODE_STATUS_SYNC_BATCH_SIZE);

    if (!candidates.length) return;

    candidates.forEach((item) => {
      const syncKey = `tv-${item.id}`;
      autoStatusSyncInFlightRef.current[syncKey] = true;
      autoStatusSyncAttemptedAtRef.current[syncKey] = now;

      (async () => {
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/tv/${item.id}?api_key=${apiKey}`,
          );
          if (!response.ok) throw new Error("Failed to fetch show metadata");
          const data = await response.json();
          const releasedEpisodeTotal = getReleasedEpisodeTotal(data);

          const trackedEpisodes = Number(item.totalEpisodes || 0);
          const watchedEpisodes = Number(item.watchedEpisodes || 0);
          const hasNewReleasedEpisodes =
            releasedEpisodeTotal > trackedEpisodes &&
            watchedEpisodes >= trackedEpisodes;

          const showRef = doc(
            db,
            ...profileSavedItemPath(
              user.email,
              activeProfileId,
              "shows",
              item.id,
            ),
          );

          if (hasNewReleasedEpisodes) {
            await setDoc(
              showRef,
              {
                status: "Watching",
                totalEpisodes: releasedEpisodeTotal,
                newEpisodeStatusCheckedAt: serverTimestamp(),
                metadataUpdatedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
            return;
          }

          if (releasedEpisodeTotal > 0 && releasedEpisodeTotal !== trackedEpisodes) {
            await setDoc(
              showRef,
              {
                totalEpisodes: releasedEpisodeTotal,
                newEpisodeStatusCheckedAt: serverTimestamp(),
                metadataUpdatedAt: serverTimestamp(),
              },
              { merge: true },
            );
            return;
          }

          await setDoc(
            showRef,
            {
              newEpisodeStatusCheckedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch {
          // Silent by design; this runs as a background sync pass.
        } finally {
          delete autoStatusSyncInFlightRef.current[syncKey];
        }
      })();
    });
  }, [savedItems, loadingSaved, user?.email, activeProfileId]);

  return (
    <SavedContentContext.Provider value={{ savedItems, loadingSaved }}>
      {children}
    </SavedContentContext.Provider>
  );
};

export const useSavedContent = () => {
  const ctx = useContext(SavedContentContext);
  if (!ctx) {
    throw new Error(
      "useSavedContent must be used inside <SavedContentProvider>",
    );
  }
  return ctx;
};
