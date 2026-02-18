import { useEffect, useMemo, useState } from "react";
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
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import Slider from "react-slick";
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
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { IoMdArrowBack } from "react-icons/io";

const CreditArrow = ({ onClick, direction }) => (
  <button
    type="button"
    onClick={onClick}
    className={`absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 flex items-center justify-center ${
      direction === "left" ? "-left-2 md:-left-4" : "-right-2 md:-right-4"
    }`}
    aria-label={direction === "left" ? "Previous credits" : "Next credits"}
  >
    {direction === "left" ? (
      <MdChevronLeft size={22} />
    ) : (
      <MdChevronRight size={22} />
    )}
  </button>
);

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
  const [knownForLocalFavouriteMap, setKnownForLocalFavouriteMap] = useState({});
  const [pendingKnownForRemove, setPendingKnownForRemove] = useState(null);
  const [aliasIndex, setAliasIndex] = useState(0);
  const [typedAlias, setTypedAlias] = useState("");
  const [isDeletingAlias, setIsDeletingAlias] = useState(false);

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
              name.toLowerCase() !== String(actor?.name || "").trim().toLowerCase(),
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

        return {
          ...credit,
          mediaType,
          status: localStatus ?? saved?.status ?? null,
          favourite:
            typeof localFavourite === "boolean"
              ? localFavourite
              : Boolean(saved?.favourite),
          isSaved: Boolean(saved) || Boolean(localStatus),
          poster:
            saved?.poster ??
            credit.poster_path ??
            credit.poster ??
            null,
          backdrop: saved?.backdrop ?? credit.backdrop_path ?? null,
          releaseDate:
            saved?.releaseDate ?? credit.release_date ?? credit.first_air_date ?? null,
        };
      }),
    [normalizedCredits, savedContentMap, knownForLocalStatusMap, knownForLocalFavouriteMap],
  );

  const isKnownForUnreleased = (item) => {
    const dateRaw = item.releaseDate || item.release_date || item.first_air_date;
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
            (Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : null),
          releaseDate: item.release_date || item.first_air_date || item.releaseDate || null,
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
      toast.success(`${item.title || item.name} is now removed from your watchlist`);
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
            (Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : null),
          releaseDate: item.release_date || item.first_air_date || item.releaseDate || null,
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

  const sliderSettings = {
    dots: false,
    infinite: false,
    speed: 450,
    slidesToShow: 5,
    slidesToScroll: 2,
    nextArrow: <CreditArrow direction="right" />,
    prevArrow: <CreditArrow direction="left" />,
    responsive: [
      { breakpoint: 1280, settings: { slidesToShow: 4, slidesToScroll: 2 } },
      { breakpoint: 1024, settings: { slidesToShow: 3, slidesToScroll: 2 } },
      { breakpoint: 768, settings: { slidesToShow: 2, slidesToScroll: 1 } },
      { breakpoint: 520, settings: { slidesToShow: 1, slidesToScroll: 1 } },
    ],
  };
  const canGoBack =
    typeof window !== "undefined" && window.history.length > 1;

  if (loading) return <Loading size={16} color="fill-white" />;
  if (!actor) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-[#090909]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 overflow-hidden"
      >
        {actor.profile_path ? (
          <img
            loading="lazy"
            className={`w-full h-full object-cover scale-110 blur-xl transition-opacity duration-700 ${
              isBackdropReady ? "opacity-100" : "opacity-0"
            }`}
            src={`https://image.tmdb.org/t/p/original${actor.profile_path}`}
            alt=""
          />
        ) : (
          <div className="w-full h-full bg-neutral-900" />
        )}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/80 to-[#090909]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.05),transparent_35%)]" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 min-h-screen overflow-y-auto px-4 md:px-8 pt-24 pb-4"
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl lg:shrink-0">
            <div className="mb-4">
              <button
                onClick={() => {
                  if (canGoBack) navigate(-1);
                }}
                disabled={!canGoBack}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/10 hover:bg-white/20 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white/10"
              >
                <IoMdArrowBack size={20} />
                Go Back
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 min-h-0">
              <div className="lg:col-span-4 min-h-0">
                <div className="relative w-full max-w-[320px] mx-auto">
                  <motion.img
                    src={
                      actor.profile_path
                        ? `https://image.tmdb.org/t/p/w500${actor.profile_path}`
                        : NotFoundPlaceholder
                    }
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = NotFoundPlaceholder;
                    }}
                    alt={actor.name}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full h-[300px] md:h-[370px] lg:h-[400px] object-cover rounded-2xl shadow-2xl shadow-black/60 transition-transform duration-300 ease-out hover:scale-[1.03]"
                  />
                  <button
                    onClick={toggleLike}
                    disabled={loadingLike}
                    title={isActorLiked ? "Remove favourite" : "Add favourite"}
                    className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition ${
                      isActorLiked
                        ? "bg-red-600/95"
                        : "bg-black/60 hover:bg-black/80"
                    }`}
                  >
                    {loadingLike ? (
                      <span className="text-xs">...</span>
                    ) : isActorLiked ? (
                      <FaHeart size={14} />
                    ) : (
                      <FaRegHeart size={14} />
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                    {actor.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                      {actor.known_for_department || "N/A"}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                      Born: {bornDisplay}
                    </span>
                    {actor.deathday && (
                      <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                        Died: {actor.deathday}
                      </span>
                    )}
                  </div>

                  {socialLinks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {socialLinks.map((entry) => (
                        <a
                          key={entry.href}
                          href={entry.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition ${entry.buttonClass}`}
                        >
                          {entry.icon}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-black/30 border border-white/10 p-3 min-h-[88px] flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Age
                    </p>
                    <p className="text-base font-semibold text-white">
                      {ageDisplay}
                    </p>
                    <p className="text-[11px] text-white/60">
                      Next: {nextBirthdayDisplay}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/30 border border-white/10 p-3 min-h-[88px] flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Known Credits
                    </p>
                    <p className="text-base font-semibold text-white">
                      {normalizedCredits.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/30 border border-white/10 p-3 min-h-[88px] flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Place of Birth
                    </p>
                    <p className="text-sm font-semibold text-white line-clamp-2">
                      {actor.place_of_birth || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-black/30 border border-white/10 p-3 min-h-[88px] min-w-0 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Also Known As
                    </p>
                    {aliases.length > 0 ? (
                      <p className="mt-1 text-sm font-semibold text-white leading-5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                        <span>{typedAlias}</span>
                        <span className="inline-block w-[1px] h-[14px] ml-1 bg-white/80 align-middle animate-pulse" />
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-white">N/A</p>
                    )}
                  </div>
                </div>

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

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-h-0 overflow-y-auto">
                  <p className="text-sm text-neutral-300 leading-relaxed line-clamp-4">
                    {actor.biography || "No biography available."}
                  </p>
                  {!!actor.biography && actor.biography.length > 220 && (
                    <button
                      onClick={() => setIsBioModalOpen(true)}
                      className="mt-2 text-sm text-blue-300/80 hover:text-blue-300"
                    >
                      Show more
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-5 lg:flex-1 lg:min-h-0 overflow-visible lg:overflow-hidden">
            <h2 className="text-xl md:text-2xl font-bold mb-3">Known For</h2>
            {knownForItems.length > 0 ? (
              <div className="px-2 md:px-4 h-full min-h-0">
                <Slider {...sliderSettings}>
                  {knownForItems.map((credit) => (
                    <div key={`${credit.mediaType}:${credit.id}`} className="px-2 pb-2">
                      <PosterCard
                        item={credit}
                        onStatusChange={handleKnownForStatusChange}
                        onFavouriteToggle={handleKnownForFavouriteToggle}
                      />
                    </div>
                  ))}
                </Slider>
              </div>
            ) : (
              <div className="text-sm text-white/60">No credits available.</div>
            )}
          </div>
        </div>
      </motion.div>

      {pendingKnownForRemove && (
        <div className="fixed inset-0 z-[140] bg-black/65 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#111] p-5">
            <h3 className="text-lg font-semibold mb-2">Remove from list?</h3>
            <p className="text-sm text-white/70">
              Remove{" "}
              <span className="text-white">
                {pendingKnownForRemove.item.title || pendingKnownForRemove.item.name}
              </span>{" "}
              from your saved list?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingKnownForRemove(null)}
                className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmKnownForRemove}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white"
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
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setIsBioModalOpen(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#111]/95"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Biography</h3>
                <button
                  onClick={() => setIsBioModalOpen(false)}
                  className="px-3 py-1.5 rounded-full text-sm bg-white/10 hover:bg-white/20"
                >
                  Close
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto max-h-[calc(80vh-64px)]">
                <p className="text-sm md:text-base text-neutral-300 leading-relaxed whitespace-pre-line">
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
