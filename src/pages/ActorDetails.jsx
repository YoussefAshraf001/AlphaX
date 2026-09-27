import { useEffect, useMemo, useRef, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import axios from "axios";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  FaFacebook,
  FaHeart,
  FaInstagram,
  FaRegHeart,
  FaTiktok,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";

import { motion, AnimatePresence } from "framer-motion";

import toast from "react-hot-toast";

import { db } from "../firebase";

import { UserAuth } from "../context/AuthContext";

import { useProfile } from "../context/ProfileContext";

import Loading from "../components/common/Loading";

import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";

import PersonalRating from "../components/actions/PersonalRating";

import PosterCard from "../components/browse/PosterCard";

import {
  profileLikedActorItemPath,
  profileRatingItemPath,
  profileSavedCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

import { IoMdArrowBack } from "react-icons/io";

const ActorDetails = () => {
  const { actorId } = useParams();

  const navigate = useNavigate();

  const { user } = UserAuth();

  const { selectedProfile } = useProfile();

  const activeProfileId = resolveProfileId(selectedProfile);

  const [actor, setActor] = useState(null);

  const [socialMedia, setSocialMedia] = useState({});

  const [credits, setCredits] = useState([]);

  const [loading, setLoading] = useState(true);

  const [loadingLike, setLoadingLike] = useState(false);

  const [isActorLiked, setIsActorLiked] = useState(false);

  const [userRatingValue, setUserRatingValue] = useState(0);

  const [isBioModalOpen, setIsBioModalOpen] = useState(false);

  const [isBackdropReady, setIsBackdropReady] = useState(false);

  const [savedContentMap, setSavedContentMap] = useState({});

  const [knownForLocalStatusMap, setKnownForLocalStatusMap] = useState({});

  const [knownForLocalFavouriteMap, setKnownForLocalFavouriteMap] = useState(
    {},
  );

  const [pendingKnownForRemove, setPendingKnownForRemove] = useState(null);

  const [aliasIndex, setAliasIndex] = useState(0);

  const [typedAlias, setTypedAlias] = useState("");

  const [isDeletingAlias, setIsDeletingAlias] = useState(false);

  const knownForStripRef = useRef(null);

  const aliases = useMemo(
    () =>
      Array.isArray(actor?.also_known_as)
        ? Array.from(
            new Set(
              actor.also_known_as

                .map((name) => String(name || "").trim())

                .filter(Boolean),
            ),
          ).filter(
            (name) =>
              name.toLowerCase() !==
              String(actor?.name || "")
                .trim()
                .toLowerCase(),
          )
        : [],

    [actor?.also_known_as, actor?.name],
  );

  useEffect(() => {
    if (!actorId) return;

    const fetchActorData = async () => {
      setLoading(true);

      try {
        const [personRes, socialRes, movieCreditsRes, tvCreditsRes] =
          await Promise.all([
            axios.get(
              `https://api.themoviedb.org/3/person/${actorId}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
            ),

            axios.get(
              `https://api.themoviedb.org/3/person/${actorId}/external_ids?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
            ),

            axios.get(
              `https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
            ),

            axios.get(
              `https://api.themoviedb.org/3/person/${actorId}/tv_credits?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
            ),
          ]);

        setActor(personRes.data);

        setSocialMedia(socialRes.data || {});

        const movies = (movieCreditsRes.data.cast || []).map((item) => ({
          ...item,

          mediaType: "movie",
        }));

        const shows = (tvCreditsRes.data.cast || []).map((item) => ({
          ...item,

          mediaType: "tv",
        }));

        const merged = [...movies, ...shows];

        const unique = Array.from(
          new Map(
            merged.map((item) => [`${item.mediaType}:${item.id}`, item]),
          ).values(),
        );

        unique.sort((a, b) => {
          const dateA = new Date(
            a.release_date || a.first_air_date || "1900-01-01",
          );

          const dateB = new Date(
            b.release_date || b.first_air_date || "1900-01-01",
          );

          return dateB.getTime() - dateA.getTime();
        });

        setCredits(unique);
      } catch (err) {
        console.error("Failed to fetch actor details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActorData();
  }, [actorId]);

  useEffect(() => {
    if (!user?.email || !actorId) {
      setIsActorLiked(false);

      return;
    }

    const ref = doc(
      db,

      ...profileLikedActorItemPath(user.email, activeProfileId, actorId),
    );

    const unsub = onSnapshot(ref, (snap) => {
      setIsActorLiked(snap.exists());
    });

    return () => unsub();
  }, [user?.email, actorId, activeProfileId]);

  useEffect(() => {
    if (!user?.email || !actorId) {
      setUserRatingValue(0);

      return;
    }

    const ratingRef = doc(
      db,

      ...profileRatingItemPath(user.email, activeProfileId, "actors", actorId),
    );

    const unsub = onSnapshot(ratingRef, (snap) => {
      if (!snap.exists()) {
        setUserRatingValue(0);

        return;
      }

      const data = snap.data() || {};

      const nextValue = Number(data.value) || 0;

      setUserRatingValue(nextValue);
    });

    return () => unsub();
  }, [user?.email, actorId, activeProfileId]);

  useEffect(() => {
    if (!user?.email) {
      setSavedContentMap({});

      return;
    }

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

    const sync = () => {
      const next = {};

      [...movies, ...shows].forEach((entry) => {
        const mediaType = entry.mediaType === "tv" ? "tv" : "movie";

        next[`${mediaType}:${entry.id}`] = entry;
      });

      setSavedContentMap(next);
    };

    const unsubMovies = onSnapshot(moviesRef, (snap) => {
      movies = snap.docs.map((d) => ({ ...d.data(), mediaType: "movie" }));

      sync();
    });

    const unsubShows = onSnapshot(showsRef, (snap) => {
      shows = snap.docs.map((d) => ({ ...d.data(), mediaType: "tv" }));

      sync();
    });

    return () => {
      unsubMovies();

      unsubShows();
    };
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    if (!actor?.profile_path) {
      setIsBackdropReady(true);

      return;
    }

    setIsBackdropReady(false);

    const preload = new Image();

    preload.src = `https://image.tmdb.org/t/p/w500${actor.profile_path}`;

    preload.onload = () => setIsBackdropReady(true);

    preload.onerror = () => setIsBackdropReady(true);
  }, [actor?.profile_path]);

  useEffect(() => {
    if (!isBioModalOpen) return;

    const onEsc = (e) => {
      if (e.key === "Escape") setIsBioModalOpen(false);
    };

    window.addEventListener("keydown", onEsc);

    return () => window.removeEventListener("keydown", onEsc);
  }, [isBioModalOpen]);

  useEffect(() => {
    setAliasIndex(0);

    setTypedAlias("");

    setIsDeletingAlias(false);
  }, [aliases]);

  useEffect(() => {
    if (!aliases.length) return;

    const currentAlias = aliases[aliasIndex % aliases.length] || "";

    let timeout = 70;

    if (!isDeletingAlias && typedAlias === currentAlias) {
      timeout = 1300;

      const timer = setTimeout(() => setIsDeletingAlias(true), timeout);

      return () => clearTimeout(timer);
    }

    if (isDeletingAlias && typedAlias.length === 0) {
      setIsDeletingAlias(false);

      setAliasIndex((prev) => (prev + 1) % aliases.length);

      return undefined;
    }

    timeout = isDeletingAlias ? 35 : 70;

    const timer = setTimeout(() => {
      setTypedAlias((prev) =>
        isDeletingAlias
          ? prev.slice(0, -1)
          : currentAlias.slice(0, prev.length + 1),
      );
    }, timeout);

    return () => clearTimeout(timer);
  }, [aliases, aliasIndex, typedAlias, isDeletingAlias]);

  const toggleLike = async () => {
    if (!user?.email) {
      toast.error("You need to be logged in to favourite actors.");

      return;
    }

    if (!actor) return;

    const ref = doc(
      db,

      ...profileLikedActorItemPath(user.email, activeProfileId, actor.id),
    );

    setLoadingLike(true);

    try {
      if (isActorLiked) {
        await deleteDoc(ref);

        setIsActorLiked(false);

        toast.success(`"${actor.name}" removed from favourites`);
      } else {
        await setDoc(ref, {
          id: actor.id,

          name: actor.name,

          image: actor.profile_path ?? null,

          updatedAt: serverTimestamp(),
        });

        setIsActorLiked(true);

        toast.success(`"${actor.name}" added to favourites`);
      }
    } catch {
      toast.error("Failed to update favourite actor");
    } finally {
      setLoadingLike(false);
    }
  };

  const savePersonalRating = async (value) => {
    if (!user?.email || !actor) {
      toast.error("You need to be logged in!");

      return;
    }

    const clamped = Math.max(0, Math.min(5, Number(value) || 0));

    const ratingRef = doc(
      db,

      ...profileRatingItemPath(user.email, activeProfileId, "actors", actor.id),
    );

    try {
      if (clamped === 0) {
        await deleteDoc(ratingRef);

        return;
      }

      await setDoc(
        ratingRef,

        {
          id: actor.id,

          title: actor.name,

          image: actor.profile_path ?? null,

          mediaType: "person",

          mode: "emoji",

          value: clamped,

          updatedAt: serverTimestamp(),
        },

        { merge: true },
      );
    } catch {
      toast.error("Failed to save rating");
    }
  };

  const socialLinks = useMemo(
    () =>
      [
        socialMedia.facebook_id && {
          href: `https://www.facebook.com/${socialMedia.facebook_id}`,

          icon: <FaFacebook size={16} className="text-white" />,

          buttonClass: "bg-[#1877F2] hover:bg-[#2d86ff]",
        },

        socialMedia.instagram_id && {
          href: `https://www.instagram.com/${socialMedia.instagram_id}`,

          icon: <FaInstagram size={16} className="text-white" />,

          buttonClass:
            "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:brightness-110",
        },

        socialMedia.tiktok_id && {
          href: `https://tiktok.com/@${socialMedia.tiktok_id}`,

          icon: <FaTiktok size={16} className="text-white" />,

          buttonClass: "bg-black hover:bg-neutral-900",
        },

        socialMedia.twitter_id && {
          href: `https://twitter.com/${socialMedia.twitter_id}`,

          icon: <FaTwitter size={16} className="text-white" />,

          buttonClass: "bg-[#1DA1F2] hover:bg-[#37b0ff]",
        },

        socialMedia.imdb_id && {
          href: `https://imdb.com/name/${socialMedia.imdb_id}`,

          icon: <span className="text-[8px] font-black text-black">IMDb</span>,

          buttonClass: "bg-[#f6c240] hover:bg-[#ffd15f]",
        },

        socialMedia.youtube_id && {
          href: `https://youtube.com/${socialMedia.youtube_id}`,

          icon: <FaYoutube size={16} className="text-white" />,

          buttonClass: "bg-[#FF0000] hover:bg-[#ff2b2b]",
        },
      ].filter(Boolean),

    [socialMedia],
  );

  const normalizedCredits = useMemo(
    () =>
      credits.map((credit) => {
        const title = credit.title || credit.name || "Untitled";

        const date = credit.release_date || credit.first_air_date || null;

        const year = date ? new Date(date).getFullYear() : null;

        const isShow = credit.mediaType === "tv" || Boolean(credit.name);

        return {
          ...credit,

          title,

          year,

          link: isShow ? `/shows/${credit.id}` : `/movies/${credit.id}`,

          posterSrc: credit.poster_path
            ? `https://image.tmdb.org/t/p/w500${credit.poster_path}`
            : NotFoundPlaceholder,
        };
      }),

    [credits],
  );

  const knownForItems = useMemo(
    () =>
      normalizedCredits.map((credit) => {
        const mediaType = credit.mediaType === "tv" ? "tv" : "movie";

        const key = `${mediaType}:${credit.id}`;

        const saved = savedContentMap[key];

        const localStatus = knownForLocalStatusMap[key];

        const localFavourite = knownForLocalFavouriteMap[key];

        const releaseDate =
          saved?.releaseDate ??
          credit.release_date ??
          credit.first_air_date ??
          null;

        const releaseDateObj = releaseDate
          ? new Date(`${releaseDate}T00:00:00`)
          : null;

        const hasValidReleaseDate =
          Boolean(releaseDateObj) && !Number.isNaN(releaseDateObj.getTime());

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const isLikelyUnreleasedMovie =
          mediaType === "movie" &&
          (!hasValidReleaseDate || releaseDateObj > today);

        return {
          ...credit,

          mediaType,

          status: localStatus ?? saved?.status ?? null,

          favourite:
            typeof localFavourite === "boolean"
              ? localFavourite
              : Boolean(saved?.favourite),

          isSaved: Boolean(saved) || Boolean(localStatus),

          poster: saved?.poster ?? credit.poster_path ?? credit.poster ?? null,

          backdrop: saved?.backdrop ?? credit.backdrop_path ?? null,

          releaseDate,

          releaseDateLabel: hasValidReleaseDate
            ? releaseDate
            : isLikelyUnreleasedMovie
              ? "TBA"
              : null,

          isUnreleased: isLikelyUnreleasedMovie,
        };
      }),

    [
      normalizedCredits,
      savedContentMap,
      knownForLocalStatusMap,
      knownForLocalFavouriteMap,
    ],
  );

  const isKnownForUnreleased = (item) => {
    const dateRaw =
      item.releaseDate || item.release_date || item.first_air_date;

    if (!dateRaw) return false;

    const date = new Date(`${dateRaw}T00:00:00`);

    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return date > today;
  };

  const handleKnownForStatusChange = async (item, status) => {
    if (!user?.email) {
      toast.error("Login required");

      return;
    }

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";

    const key = `${mediaType}:${item.id}`;

    const typeDoc = mediaType === "tv" ? "shows" : "movies";

    if (!status) {
      setPendingKnownForRemove({ item, key, typeDoc });

      return;
    }

    setKnownForLocalStatusMap((prev) => ({ ...prev, [key]: status }));

    try {
      const ref = doc(
        db,

        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );

      await setDoc(
        ref,

        {
          id: Number(item.id),

          title: item.title || item.name,

          poster: item.poster_path || item.poster || null,

          backdrop: item.backdrop_path || item.backdrop || null,

          overview: item.overview || null,

          runtime:
            item.runtime ||
            (Array.isArray(item.episode_run_time)
              ? item.episode_run_time[0]
              : null),

          releaseDate:
            item.release_date ||
            item.first_air_date ||
            item.releaseDate ||
            null,

          rating: item.vote_average ?? item.rating ?? null,

          mediaType,

          status,

          updatedAt: serverTimestamp(),
        },

        { merge: true },
      );

      toast.success(`${item.title || item.name} is now in your watchlist`);
    } catch {
      toast.error("Failed to update status");

      setKnownForLocalStatusMap((prev) => {
        const next = { ...prev };

        delete next[key];

        return next;
      });
    }
  };

  const confirmKnownForRemove = async () => {
    if (!pendingKnownForRemove || !user?.email) return;

    const { item, key, typeDoc } = pendingKnownForRemove;

    try {
      const ref = doc(
        db,

        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );

      await deleteDoc(ref);

      setKnownForLocalStatusMap((prev) => ({ ...prev, [key]: null }));

      setKnownForLocalFavouriteMap((prev) => ({ ...prev, [key]: false }));

      toast.success(
        `${item.title || item.name} is now removed from your watchlist`,
      );
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setPendingKnownForRemove(null);
    }
  };

  const handleKnownForFavouriteToggle = async (item, favourite) => {
    if (!user?.email) {
      toast.error("Login required");

      return;
    }

    if (isKnownForUnreleased(item)) {
      toast("Favourites unlock on release", { icon: "i" });

      return;
    }

    const mediaType = item.mediaType === "tv" ? "tv" : "movie";

    const key = `${mediaType}:${item.id}`;

    const typeDoc = mediaType === "tv" ? "shows" : "movies";

    setKnownForLocalFavouriteMap((prev) => ({ ...prev, [key]: favourite }));

    try {
      const ref = doc(
        db,

        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
      );

      await setDoc(
        ref,

        {
          id: Number(item.id),

          title: item.title || item.name,

          poster: item.poster_path || item.poster || null,

          backdrop: item.backdrop_path || item.backdrop || null,

          overview: item.overview || null,

          runtime:
            item.runtime ||
            (Array.isArray(item.episode_run_time)
              ? item.episode_run_time[0]
              : null),

          releaseDate:
            item.release_date ||
            item.first_air_date ||
            item.releaseDate ||
            null,

          rating: item.vote_average ?? item.rating ?? null,

          mediaType,

          status: item.status ?? null,

          favourite,

          updatedAt: serverTimestamp(),
        },

        { merge: true },
      );

      toast.success(
        favourite
          ? `${item.title || item.name} is now a favourite`
          : `${item.title || item.name} is now removed from your favourites`,
      );
    } catch {
      toast.error("Failed to update favourite");

      setKnownForLocalFavouriteMap((prev) => {
        const next = { ...prev };

        delete next[key];

        return next;
      });
    }
  };

  const ageDisplay = useMemo(() => {
    if (!actor?.birthday) return "N/A";

    const birth = new Date(actor.birthday);

    if (Number.isNaN(birth.getTime())) return "N/A";

    const end = actor.deathday ? new Date(actor.deathday) : new Date();

    if (Number.isNaN(end.getTime())) return "N/A";

    let age = end.getFullYear() - birth.getFullYear();

    const hasNotHadBirthdayYet =
      end.getMonth() < birth.getMonth() ||
      (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate());

    if (hasNotHadBirthdayYet) age -= 1;

    return age >= 0 ? String(age) : "N/A";
  }, [actor?.birthday, actor?.deathday]);

  const nextBirthdayDisplay = useMemo(() => {
    if (!actor?.birthday || actor?.deathday) return "N/A";

    const birth = new Date(actor.birthday);

    if (Number.isNaN(birth.getTime())) return "N/A";

    const today = new Date();

    const currentYear = today.getFullYear();

    let next = new Date(currentYear, birth.getMonth(), birth.getDate());

    next.setHours(0, 0, 0, 0);

    const todayStart = new Date(today);

    todayStart.setHours(0, 0, 0, 0);

    if (next < todayStart) {
      next = new Date(currentYear + 1, birth.getMonth(), birth.getDate());

      next.setHours(0, 0, 0, 0);
    }

    const turns = next.getFullYear() - birth.getFullYear();

    const dateLabel = next.toLocaleDateString("en-US", {
      month: "short",

      day: "numeric",
    });

    return `${dateLabel} (turning ${turns})`;
  }, [actor?.birthday, actor?.deathday]);

  const bornDisplay = useMemo(() => {
    if (!actor?.birthday) return "N/A";

    const birth = new Date(actor.birthday);

    if (Number.isNaN(birth.getTime())) return actor.birthday;

    return birth.toLocaleDateString("en-US", {
      year: "numeric",

      month: "short",

      day: "numeric",
    });
  }, [actor?.birthday]);

  const scrollKnownForBy = (direction) => {
    const container = knownForStripRef.current;

    if (!container) return;

    const delta = Math.max(320, Math.floor(container.clientWidth * 0.85));

    container.scrollBy({
      left: direction === "left" ? -delta : delta,

      behavior: "smooth",
    });
  };

  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  if (loading) return <Loading size={16} color="fill-white" />;

  if (!actor) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white selection:bg-[#e50914] selection:text-white">
      {/* Netflix-inspired cinematic hero */}
      <section className="relative min-h-[760px] overflow-hidden lg:min-h-[820px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {actor.profile_path ? (
            <img
              src={`https://image.tmdb.org/t/p/original${actor.profile_path}`}
              alt=""
              className={`h-full w-full object-cover object-[72%_18%] transition-opacity duration-700 md:object-[75%_20%] ${
                isBackdropReady ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="h-full w-full bg-[#151515]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/90 via-40% to-transparent md:via-[#080808]/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent via-55% to-black/45" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#080808] to-transparent" />
        </motion.div>

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1600px] flex-col px-4 pb-24 pt-24 sm:px-6 md:px-10 lg:min-h-[820px] lg:px-14 xl:px-16">
          <button
            onClick={() => canGoBack && navigate(-1)}
            disabled={!canGoBack}
            className="group mb-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Go back"
          >
            <IoMdArrowBack
              size={22}
              className="transition-transform group-hover:-translate-x-0.5"
            />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#e50914]">
              {actor.known_for_department || "Person"}
            </p>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.92] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-8xl">
              {actor.name}
            </h1>

            {aliases.length > 0 && (
              <div className="mt-4 flex h-6 items-center text-sm text-white/55">
                <span className="mr-2 text-white/30">Also known as</span>
                <span className="font-medium text-white/80">{typedAlias}</span>
                <span className="ml-1 inline-block h-4 w-px animate-pulse bg-white/70" />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-white/70">
              <span className="text-[#46d369]">
                {knownForItems.length} credits
              </span>
              <span className="text-white/25">•</span>
              <span>{bornDisplay}</span>
              <span className="text-white/25">•</span>
              <span>
                {ageDisplay === "N/A" ? "Age unknown" : `Age ${ageDisplay}`}
              </span>
              {actor.deathday && (
                <>
                  <span className="text-white/25">•</span>
                  <span>Died {actor.deathday}</span>
                </>
              )}
            </div>

            <p className="mt-5 line-clamp-4 max-w-xl text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
              {actor.biography || "No biography available."}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={toggleLike}
                disabled={loadingLike}
                className={`flex h-11 items-center gap-2 rounded-md px-5 text-sm font-bold transition ${
                  isActorLiked
                    ? "bg-[#e50914] text-white hover:bg-[#f6121d]"
                    : "bg-white text-black hover:bg-white/80"
                }`}
              >
                {loadingLike ? (
                  <span>...</span>
                ) : isActorLiked ? (
                  <FaHeart size={15} />
                ) : (
                  <FaRegHeart size={15} />
                )}
                {isActorLiked ? "Favourited" : "Favourite"}
              </button>

              {!!actor.biography && actor.biography.length > 220 && (
                <button
                  onClick={() => setIsBioModalOpen(true)}
                  className="h-11 rounded-md bg-[#6d6d6e]/70 px-5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-[#6d6d6e]/50"
                >
                  More info
                </button>
              )}

              {socialLinks.length > 0 && (
                <div className="ml-0 flex items-center gap-2 sm:ml-2">
                  {socialLinks.map((entry) => (
                    <a
                      key={entry.href}
                      href={entry.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-white/15 transition hover:scale-110 ${entry.buttonClass}`}
                    >
                      {entry.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content starts inside the hero fade, like a Netflix detail page */}
      <main className="relative z-20 mx-auto -mt-20 max-w-[1600px] px-4 pb-16 sm:px-6 md:px-10 lg:px-14 xl:px-16">
        <section className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/35">
                  Your profile
                </p>
                <h2 className="text-2xl font-bold tracking-tight">
                  Rate {actor.name}
                </h2>
              </div>
            </div>

            <div className="max-w-xl rounded-xl bg-[#181818] p-4 ring-1 ring-white/[0.06] sm:p-5">
              <PersonalRating
                ratingType="emoji"
                value={userRatingValue}
                modeHint="Emoji rating only."
                onRate={(value) => {
                  setUserRatingValue(value);
                  savePersonalRating(value);
                }}
                disabled={!user?.email}
                disabledLabel="Sign in to rate actors."
                disabledToastMessage="Sign in to rate actors."
              />
            </div>
          </div>

          <aside className="space-y-4 text-sm">
            <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-white/10 pb-3">
              <span className="text-white/40">Born</span>
              <span className="font-medium text-white/85">{bornDisplay}</span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-white/10 pb-3">
              <span className="text-white/40">Birthplace</span>
              <span className="font-medium text-white/85">
                {actor.place_of_birth || "N/A"}
              </span>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-white/10 pb-3">
              <span className="text-white/40">Age</span>
              <span className="font-medium text-white/85">{ageDisplay}</span>
            </div>
            {!actor.deathday && (
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <span className="text-white/40">Next birthday</span>
                <span className="font-medium text-white/85">
                  {nextBirthdayDisplay}
                </span>
              </div>
            )}
          </aside>
        </section>

        <section className="pt-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Known For
            </h2>
            {knownForItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => scrollKnownForBy("left")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg transition hover:border-white/50 hover:bg-white hover:text-black"
                  aria-label="Previous credits"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => scrollKnownForBy("right")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-lg transition hover:border-white/50 hover:bg-white hover:text-black"
                  aria-label="Next credits"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {knownForItems.length > 0 ? (
            <div
              ref={knownForStripRef}
              className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-8 pt-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-3"
            >
              {knownForItems.map((credit) => (
                <motion.div
                  key={`${credit.mediaType}:${credit.id}`}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.18 }}
                  className="w-[170px] shrink-0 sm:w-[190px] lg:w-[210px]"
                >
                  <PosterCard
                    item={credit}
                    onStatusChange={handleKnownForStatusChange}
                    onFavouriteToggle={handleKnownForFavouriteToggle}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-[#181818] px-5 py-8 text-sm text-white/50">
              No credits available.
            </div>
          )}
        </section>
      </main>

      {pendingKnownForRemove && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-[#181818] p-6 shadow-2xl ring-1 ring-white/10">
            <h3 className="text-xl font-bold">Remove from list?</h3>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Remove{" "}
              <span className="font-medium text-white">
                {pendingKnownForRemove.item.title ||
                  pendingKnownForRemove.item.name}
              </span>{" "}
              from your saved list?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setPendingKnownForRemove(null)}
                className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmKnownForRemove}
                className="rounded-md bg-[#e50914] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#f6121d]"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isBioModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setIsBioModalOpen(false)}
          >
            <motion.div
              initial={{ y: 28, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 28, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-xl bg-[#181818] shadow-2xl ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e50914]">
                    About
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{actor.name}</h3>
                </div>
                <button
                  onClick={() => setIsBioModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2a2a2a] text-lg text-white transition hover:bg-white hover:text-black"
                  aria-label="Close biography"
                >
                  ×
                </button>
              </div>
              <div className="max-h-[calc(82vh-82px)] overflow-y-auto px-6 py-5">
                <p className="whitespace-pre-line text-sm leading-7 text-white/70 md:text-base">
                  {actor.biography}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActorDetails;
