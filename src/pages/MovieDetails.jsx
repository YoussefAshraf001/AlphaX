import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  deleteDoc,
} from "firebase/firestore";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { MdChevronLeft, MdChevronRight, MdStarRate } from "react-icons/md";
import { IoMdArrowBack, IoMdTime } from "react-icons/io";
import toast from "react-hot-toast";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { motion, AnimatePresence } from "framer-motion";

import { db } from "../firebase";
import ScreenshotsModal from "../components/browse/ScreenshotsModal";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";
import PersonalRating from "../components/actions/PersonalRating";
import {
  profileRatingItemPath,
  profileSavedItemPath,
  profileLikedActorItemPath,
  profileLikedActorsCollectionPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const MovieDetails = () => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const { id } = useParams();
  const navigate = useNavigate();
  const activeProfileId = resolveProfileId(selectedProfile);

  const [movie, setMovie] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState("");
  const [backdrops, setBackdrops] = useState([]);
  const [cast, setCast] = useState([]);
  const [likedActors, setLikedActors] = useState(new Set());
  const [reviews, setReviews] = useState([]);
  const [awards, setAwards] = useState([]);
  const [selectedBackdropIndex, setSelectedBackdropIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [favourite, setFavourite] = useState(false);
  const [userRatingValue, setUserRatingValue] = useState(0);
  const [activeTab, setActiveTab] = useState("cast");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [loadedCastImages, setLoadedCastImages] = useState({});
  const [failedCastImages, setFailedCastImages] = useState({});
  const [isBackdropReady, setIsBackdropReady] = useState(false);

  const STATUS_ACTIONS = [
    { key: "Want to Watch", label: "Want to Watch" },
    { key: "Watching", label: "Watching" },
    { key: "Watched", label: "Watched" },
    { key: "Paused", label: "Paused" },
    { key: "Dropped", label: "Dropped" },
  ];

  const CastArrow = ({ onClick, direction }) => (
    <button
      type="button"
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 flex items-center justify-center ${
        direction === "left" ? "-left-3 md:-left-5" : "-right-3 md:-right-5"
      }`}
      aria-label={direction === "left" ? "Previous cast" : "Next cast"}
    >
      {direction === "left" ? (
        <MdChevronLeft size={24} />
      ) : (
        <MdChevronRight size={24} />
      )}
    </button>
  );

  const markCastImageLoaded = (actorId) => {
    setLoadedCastImages((prev) => {
      if (prev[actorId]) return prev;
      return { ...prev, [actorId]: true };
    });
  };

  const markCastImageFailed = (actorId) => {
    setFailedCastImages((prev) => {
      if (prev[actorId]) return prev;
      return { ...prev, [actorId]: true };
    });
  };

  useEffect(() => {
    if (!user?.email || !movie) return;

    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, "movies", movie.id),
    );

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setStatus(snap.data().status);
        setFavourite(Boolean(snap.data().favourite));
      } else {
        setStatus(null);
        setFavourite(false);
      }
    });

    return () => unsubscribe();
  }, [user?.email, movie, movie?.id, activeProfileId]);

  useEffect(() => {
    if (!user?.email || !movie?.id) {
      setUserRatingValue(0);
      return;
    }

    const ratingRef = doc(
      db,
      ...profileRatingItemPath(user.email, activeProfileId, "movies", movie.id),
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
  }, [user?.email, movie?.id, activeProfileId]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const [movieRes, castRes, imagesRes, reviewsRes] = await Promise.all([
          axios.get(
            `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/movie/${id}/images?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/movie/${id}/reviews?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
        ]);

        setMovie(movieRes.data);
        setCast(
          (castRes.data.cast || []).map((actor, index) => ({
            ...actor,
            _castKey:
              actor.credit_id ??
              actor.cast_id ??
              `${actor.id ?? "actor"}-${index}`,
          })),
        );
        setBackdrops(imagesRes.data.backdrops);
        setReviews(reviewsRes.data.results);
      } catch (err) {
        console.error("Failed to fetch movie details", err);
      }
    };

    fetchMovieDetails();
  }, [id]);

  const fetchTrailer = async (movieId) => {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
      );
      const trailer = response.data.results.find(
        (video) => video.type === "Trailer" && video.site === "YouTube",
      );
      if (trailer) {
        setTrailerUrl(`https://www.youtube.com/embed/${trailer.key}`);
      } else {
        setTrailerUrl("");
        toast.error("No trailer available for this title.");
      }
    } catch (error) {
      toast.error("Could not load trailer right now.");
    }
  };

  useEffect(() => {
    const fetchAwards = async (movieData) => {
      try {
        const response = await axios.get(
          `https://www.omdbapi.com/?i=${movieData.imdb_id}&apikey=${process.env.REACT_APP_OMDB_API_KEY}`,
        );
        setAwards(response.data.Awards);
      } catch (error) {
        console.error("Error fetching awards:", error);
      }
    };
    if (movie) {
      fetchAwards(movie);
    }
  }, [movie]);

  useEffect(() => {
    if (!user?.email) return;

    const ref = collection(
      db,
      ...profileLikedActorsCollectionPath(user.email, activeProfileId),
    );

    const unsubscribe = onSnapshot(ref, (snap) => {
      const ids = new Set(snap.docs.map((d) => Number(d.id)));
      setLikedActors(ids);
    });

    return () => unsubscribe();
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    setLoadedCastImages({});
    setFailedCastImages({});
  }, [cast]);

  useEffect(() => {
    if (!movie?.backdrop_path) {
      setIsBackdropReady(true);
      return;
    }

    setIsBackdropReady(false);
    const preload = new Image();
    preload.src = `https://image.tmdb.org/t/p/w500/${movie.backdrop_path}`;
    preload.onload = () => setIsBackdropReady(true);
    preload.onerror = () => setIsBackdropReady(true);
  }, [movie?.backdrop_path]);

  const saveActor = async (actor) => {
    if (!user) return toast.error("You need to be logged in!");

    try {
      const ref = doc(
        db,
        ...profileLikedActorItemPath(user.email, activeProfileId, actor.id),
      );

      await setDoc(ref, {
        id: actor.id,
        name: actor.name,
        image: actor.profile_path ?? null,
        updatedAt: serverTimestamp(),
      });

      setLikedActors((prev) => new Set(prev).add(actor.id));
      toast.success(`"${actor.name}" added to favourites`);
    } catch {
      toast.error("Failed to save actor");
    }
  };

  const removeActor = async (actor) => {
    if (!user) return toast.error("You need to be logged in!");

    try {
      const ref = doc(
        db,
        ...profileLikedActorItemPath(user.email, activeProfileId, actor.id),
      );

      await deleteDoc(ref);

      setLikedActors((prev) => {
        const next = new Set(prev);
        next.delete(actor.id);
        return next;
      });

      toast.success(`"${actor.name}" removed from favourites`);
    } catch {
      toast.error("Failed to remove actor");
    }
  };

  const handleWatchLaterClick = () => {
    if (movie) {
      fetchTrailer(movie.id);
    }
  };

  const handleClose = () => {
    setTrailerUrl("");
  };

  const saveWithStatus = async (newStatus) => {
    if (!user?.email || !movie) {
      toast.error("You need to be logged in!");
      return;
    }

    if (status === newStatus) {
      toast(
        `Already marked as "${
          STATUS_ACTIONS.find((s) => s.key === newStatus)?.label
        }"`,
        { icon: "i" },
      );
      return;
    }

    try {
      const isTV = !!movie.first_air_date;
      const typeDoc = isTV ? "shows" : "movies";

      const contentRef = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, typeDoc, movie.id),
      );

      const payload = {
        id: movie.id,
        title: movie.title || movie.name,
        poster: movie.poster_path || null,
        backdrop: movie.backdrop_path || null,
        overview: movie.overview,
        runtime: movie.runtime || null,
        releaseDate: movie.release_date || movie.first_air_date || null,
        rating: movie.vote_average,
        mediaType: isTV ? "tv" : "movie",
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      await setDoc(contentRef, payload, { merge: true });
      setStatus(newStatus);

      toast.success(
        `"${movie.title || movie.name}" marked as ${
          STATUS_ACTIONS.find((s) => s.key === newStatus)?.label
        }`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save watch status");
    }
  };

  const removeFromList = async () => {
    if (!user?.email || !movie) {
      toast.error("You need to be logged in!");
      return;
    }

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, "movies", movie.id),
      );

      await deleteDoc(ref);
      setStatus(null);
      setFavourite(false);
      toast.success(`"${movie.title || movie.name}" removed from your list`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove from list");
    }
  };

  const toggleFavourite = async () => {
    if (!user?.email || !movie) {
      toast.error("You need to be logged in!");
      return;
    }
    if (isUnreleased) {
      toast("Favourites unlock on release", { icon: "🔒" });
      return;
    }

    const next = !favourite;
    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, "movies", movie.id),
    );

    try {
      await setDoc(
        ref,
        {
          id: movie.id,
          title: movie.title || movie.name,
          poster: movie.poster_path || null,
          backdrop: movie.backdrop_path || null,
          overview: movie.overview,
          runtime: movie.runtime || null,
          releaseDate: movie.release_date || null,
          rating: movie.vote_average,
          mediaType: "movie",
          status: status ?? null,
          favourite: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setFavourite(next);
      toast.success(next ? "Added to favourites" : "Removed from favourites");
    } catch {
      toast.error("Failed to update favourite");
    }
  };

  const savePersonalRating = async (value) => {
    if (!user?.email || !movie?.id) {
      toast.error("You need to be logged in!");
      return;
    }
    if (isUnreleased) {
      toast("Rating unlocks when this title releases.", { icon: "i" });
      return;
    }

    const clamped = Math.max(0, Math.min(5, Number(value) || 0));
    const ratingRef = doc(
      db,
      ...profileRatingItemPath(user.email, activeProfileId, "movies", movie.id),
    );

    try {
      if (clamped === 0) {
        await deleteDoc(ratingRef);
        return;
      }

      await setDoc(
        ratingRef,
        {
          id: movie.id,
          title: movie.title || movie.name,
          mediaType: "movie",
          mode: "stars",
          value: clamped,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      toast.error("Failed to save rating");
    }
  };

  if (!movie) {
    return null;
  }

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const screenshotsSliderSettings = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 2,
    initialSlide: 0,
    nextArrow: <CastArrow direction="right" />,
    prevArrow: <CastArrow direction="left" />,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 3,
        },
      },
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  const CastSlider = {
    dots: false,
    infinite: false,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 3,
    initialSlide: 0,
    nextArrow: <CastArrow direction="right" />,
    prevArrow: <CastArrow direction="left" />,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  function formatBudget(budget) {
    if (!budget || budget <= 0) return null;
    if (budget >= 1_000_000) {
      return `$${(budget / 1_000_000).toFixed(1)}M`;
    } else if (budget >= 1_000) {
      return `$${(budget / 1_000).toFixed(1)}K`;
    } else {
      return `$${budget}`;
    }
  }

  const formattedBudget = formatBudget(movie.budget);
  const voteAverage = Number(movie.vote_average || 0);
  const voteCount = Number(movie.vote_count || 0);
  const ratingPercent = Math.round(voteAverage * 10);
  const hasRating = voteCount > 0 && voteAverage > 0;
  const scorePercentDisplay = hasRating ? `${ratingPercent}%` : "Not rated";
  const minutes = movie.runtime || 0;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const runtimeDisplay = minutes ? `${hours}h ${remainingMinutes}m` : "N/A";
  const releaseYear = movie.release_date
    ? movie.release_date.substring(0, 4)
    : "N/A";
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;
  const isUnreleased =
    Boolean(movie.release_date) &&
    new Date(`${movie.release_date}T00:00:00`).getTime() >
      new Date().setHours(0, 0, 0, 0);
  const votesDisplay =
    voteCount > 0 ? voteCount : isUnreleased ? "Unreleased" : "No votes";

  return (
    <div className="relative min-h-screen text-white bg-[#090909]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 overflow-hidden"
      >
        {movie.backdrop_path ? (
          <img
            loading="lazy"
            className={`w-full h-full object-cover scale-110 blur-xl transition-opacity duration-700 ${
              isBackdropReady ? "opacity-100" : "opacity-0"
            }`}
            src={`https://image.tmdb.org/t/p/w500/${movie.backdrop_path}`}
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
        className="relative z-10 px-4 md:px-8 pt-24 pb-12"
      >
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-5 md:p-8 shadow-2xl">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-4">
                <div className="relative w-full max-w-[320px] mx-auto">
                  <motion.img
                    src={
                      movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}`
                        : NotFoundPlaceholder
                    }
                    alt={movie.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = NotFoundPlaceholder;
                    }}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full h-[460px] object-cover rounded-2xl shadow-2xl shadow-black/60"
                  />
                  <button
                    onClick={toggleFavourite}
                    title={
                      isUnreleased
                        ? "Favourites unlock on release"
                        : favourite
                          ? "Remove favourite"
                          : "Add favourite"
                    }
                    className={`absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition ${
                      isUnreleased
                        ? "bg-black/65 text-white/45 border border-white/30 shadow-lg shadow-black/70 backdrop-blur-sm"
                        : favourite
                        ? "bg-red-600/95 border border-red-300/60 shadow-lg shadow-red-900/40 backdrop-blur-sm"
                        : "bg-black/75 border border-white/45 shadow-lg shadow-black/70 backdrop-blur-sm hover:bg-black/90"
                    }`}
                  >
                    {favourite ? (
                      <FaHeart size={14} />
                    ) : (
                      <FaRegHeart size={14} />
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col gap-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                      {movie.title}
                    </h1>
                    {status && (
                      <button
                        onClick={() => setRemoveConfirmOpen(true)}
                        className="shrink-0 px-4 py-2.5 rounded-full text-xs md:text-sm font-semibold transition bg-white/10 hover:bg-red-600/80 text-white"
                      >
                        Remove from Watchlist
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                      {releaseYear}
                    </span>
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                      <IoMdTime size={14} className="opacity-80" />
                      {runtimeDisplay}
                    </span>
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full border border-yellow-400/40 bg-yellow-500/10 text-yellow-200">
                      <MdStarRate size={15} className="text-yellow-300" />
                      {scorePercentDisplay}
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleWatchLaterClick}
                      className="rounded-xl border text-white font-semibold border-gray-300 hover:bg-gray-300 hover:text-black hover:-translate-y-1 transform ease-in-out duration-300 py-2 px-5"
                    >
                      Watch Trailer
                    </button>
                  </div>
                </div>

                <p className="text-neutral-300 leading-relaxed text-sm md:text-base max-w-3xl">
                  {movie.overview}
                </p>

                <div className="flex flex-wrap gap-2">
                  {(movie.genres || []).map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white border border-white/25"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Budget
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {formattedBudget || "Not reported"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Language
                    </p>
                    <p className="text-sm font-semibold text-white uppercase">
                      {movie.original_language || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Audience Score
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {scorePercentDisplay}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Votes
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {votesDisplay}
                    </p>
                  </div>
                </div>

                <PersonalRating
                  ratingType="stars"
                  value={userRatingValue}
                  starSizeClass="text-3xl"
                  onRate={(value) => {
                    setUserRatingValue(value);
                    savePersonalRating(value);
                  }}
                  disabled={!user?.email || isUnreleased}
                  disabledLabel={
                    !user?.email
                      ? "Sign in to rate this movie."
                      : "This movie is unreleased. Rating unlocks on release."
                  }
                  disabledToastMessage={
                    !user?.email
                      ? "Sign in to rate titles."
                      : "Rating unlocks on release"
                  }
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  {STATUS_ACTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => saveWithStatus(s.key)}
                      title={s.label}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                        status === s.key
                          ? "bg-red-600 text-white shadow-lg shadow-red-700/30"
                          : "bg-white/10 hover:bg-white/20 text-neutral-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/55 flex items-center gap-1">
                  <span aria-hidden="true">↓</span>
                  Cast, reviews, screenshots, and awards are below
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {trailerUrl && (
              <div className="fixed inset-0 flex items-center justify-center z-[102] bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#111] border border-white/10 p-4 md:p-5 rounded-2xl w-full max-w-5xl"
                >
                  <div className="pb-3">
                    <div className="flex justify-between items-center gap-3 px-1">
                      <h2 className="font-semibold text-white text-lg">
                        {movie?.title} Trailer
                      </h2>
                      <button
                        onClick={handleClose}
                        className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <iframe
                    className="w-full h-60 md:h-80 lg:h-[520px] rounded-xl"
                    src={trailerUrl}
                    title="Trailer"
                    frameBorder="0"
                    allowFullScreen
                  ></iframe>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-6 h-[30vh] min-h-[30vh] max-h-[760px] flex flex-col overflow-hidden">
            <div className="flex flex-wrap justify-center gap-2 overflow-x-auto">
              {["cast", "review", "screenshots", "awards"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`py-2 px-4 text-sm rounded-full capitalize transition ${
                    activeTab === tab
                      ? "bg-white text-black"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
              {activeTab === "cast" && (
                <>
                  <div className="relative px-6 md:px-10">
                    <Slider {...CastSlider} key={cast.length}>
                      {cast.map((actor) => {
                        const isLiked = likedActors.has(actor.id);
                        const canShowImage =
                          Boolean(actor.profile_path) &&
                          !failedCastImages[actor.id];
                        const profileSrc = canShowImage
                          ? `https://image.tmdb.org/t/p/w500/${actor.profile_path}`
                          : null;
                        const isImageLoaded = !!loadedCastImages[actor.id];
                        return (
                          <motion.div
                            key={actor._castKey || actor.id}
                            className="flex-shrink-0 w-full p-2"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="flex items-center bg-[#131313] border border-white/10 rounded-2xl overflow-hidden shadow-xl relative">
                              <div className="w-24 h-36 relative bg-neutral-800 overflow-hidden">
                                {canShowImage ? (
                                  <>
                                    <div
                                      className={`absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-800 transition-opacity duration-300 ${
                                        isImageLoaded
                                          ? "opacity-0 pointer-events-none"
                                          : "opacity-100"
                                      }`}
                                    />
                                    <img
                                      src={profileSrc}
                                      alt={actor.name}
                                      loading="lazy"
                                      ref={(imgEl) => {
                                        if (
                                          imgEl &&
                                          imgEl.complete &&
                                          imgEl.naturalWidth > 0
                                        ) {
                                          markCastImageLoaded(actor.id);
                                        }
                                      }}
                                      onLoad={() =>
                                        markCastImageLoaded(actor.id)
                                      }
                                      onError={() =>
                                        markCastImageFailed(actor.id)
                                      }
                                      className={`w-full h-full object-cover transition-opacity duration-500 ${
                                        isImageLoaded
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                  </>
                                ) : (
                                  <div className="absolute inset-0 bg-neutral-700/70 flex items-center justify-center">
                                    <div className="text-[10px] text-white/80 text-center px-2">
                                      No Image
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex-grow p-2 flex flex-col justify-between">
                                <Link
                                  to={`/person/${actor.id}`}
                                  className="text-lg font-semibold text-white text-center hover:underline"
                                >
                                  {actor.name}
                                </Link>
                              </div>
                              <span className="absolute top-2 right-2">
                                {isLiked ? (
                                  <FaHeart
                                    className="text-red-500 cursor-pointer"
                                    onClick={() => removeActor(actor)}
                                  />
                                ) : (
                                  <FaRegHeart
                                    className="text-gray-300 cursor-pointer"
                                    onClick={() => saveActor(actor)}
                                  />
                                )}
                              </span>
                            </div>
                            <span className="text-sm text-gray-300 block mt-1">
                              as{" "}
                              {actor.character ? `${actor.character}` : "TBA"}
                            </span>
                          </motion.div>
                        );
                      })}
                    </Slider>
                  </div>
                </>
              )}

              {activeTab === "screenshots" && (
                <>
                  <div className="relative px-6 md:px-10">
                    {backdrops.length ? (
                      <Slider {...screenshotsSliderSettings}>
                        {backdrops.map((backdrop, index) => (
                          <motion.div
                            key={backdrop.file_path}
                            className="px-1"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              setSelectedBackdropIndex(index);
                              setIsModalOpen(true);
                            }}
                          >
                            <motion.img
                              src={`https://image.tmdb.org/t/p/w500/${backdrop.file_path}`}
                              alt={movie.name}
                              initial={{ opacity: 0, scale: 1.03 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.5 }}
                              className="w-full h-[160px] md:h-[150px] object-cover rounded-2xl shadow-lg cursor-pointer border border-white/10"
                            />
                          </motion.div>
                        ))}
                      </Slider>
                    ) : (
                      <div className="w-full h-[170px] md:h-[190px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-white/70">
                        No screenshots available for this title.
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "review" && (
                <>
                  <div className="pr-2">
                    {reviews.length > 0 ? (
                      reviews.map((review) => (
                        <motion.div
                          key={review.id}
                          className="mb-3 p-4 rounded-xl bg-white/5 border border-white/10"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-start mb-2">
                            {review.author_details.avatar_path ? (
                              <img
                                loading="lazy"
                                src={`https://image.tmdb.org/t/p/w500${review.author_details.avatar_path}`}
                                alt={review.author}
                                className="w-12 h-12 rounded-full mr-3 object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white">
                                ?
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold">{review.author}</h3>
                              <p className="text-gray-400">
                                @{review.author_details.username}
                              </p>
                            </div>
                          </div>
                          <p className="text-gray-300">{review.content}</p>
                        </motion.div>
                      ))
                    ) : (
                      <div className="w-full h-[170px] md:h-[190px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-white/70">
                        No reviews available for this title.
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "awards" && (
                <>
                  <motion.div
                    className="space-y-4 pb-4"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 capitalize">
                      {awards && awards !== "N/A" ? (
                        <p className="text-gray-300 pb-1 text-center">
                          <span className="ml-1">{awards}</span>
                        </p>
                      ) : (
                        <div className="h-[120px] flex items-center justify-center text-sm text-white/70">
                          No awards information available.
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <ScreenshotsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        images={backdrops}
        currentIndex={selectedBackdropIndex}
        setCurrentIndex={setSelectedBackdropIndex}
        media={movie}
      />

      {removeConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#111] p-5">
            <h3 className="text-lg font-semibold mb-2">Remove from list?</h3>
            <p className="text-sm text-white/70">
              Remove <span className="text-white">{movie.title}</span> from your
              saved list?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setRemoveConfirmOpen(false)}
                className="px-4 py-2 text-sm rounded-md bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeFromList();
                  setRemoveConfirmOpen(false);
                }}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetails;
