import { createContext, useContext, useEffect, useState } from "react";
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

export const SavedContentProvider = ({ children }) => {
  const { user } = UserAuth();
  const { selectedProfile, profileLoading } = useProfile();
  const [savedItems, setSavedItems] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const activeProfileId = resolveProfileId(selectedProfile);

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
