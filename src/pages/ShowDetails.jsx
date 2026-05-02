import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  collection,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import {
  MdChevronLeft,
  MdChevronRight,
  MdRestartAlt,
  MdStarRate,
} from "react-icons/md";
import toast from "react-hot-toast";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { motion, AnimatePresence } from "framer-motion";
import ScreenshotsModal from "../components/browse/ScreenshotsModal";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { IoMdArrowBack, IoMdClose } from "react-icons/io";
import PersonalRating from "../components/actions/PersonalRating";
import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";
import {
  profileLikedActorItemPath,
  profileLikedActorsCollectionPath,
  profileRatingItemPath,
  profileRatingsCollectionPath,
  profileSavedItemPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const ACTOR_REACTION_EMOJIS = ["😡", "😕", "😐", "🙂", "😍"];

const STATUS_ACTIONS = [
  { key: "Want to Watch", label: "Want to Watch" },
  { key: "Watching", label: "Watching" },
  { key: "Finished", label: "Finished" },
  { key: "Paused", label: "Paused" },
  { key: "Dropped", label: "Dropped" },
];

const ShowDetails = () => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const { id } = useParams();
  const navigate = useNavigate();
  const activeProfileId = resolveProfileId(selectedProfile);

  const [show, setShow] = useState(null);
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
  const [savedNotes, setSavedNotes] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isNotesLoading, setIsNotesLoading] = useState(true);
  const [savedTotalEpisodes, setSavedTotalEpisodes] = useState(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState(0);
  const [activeTab, setActiveTab] = useState("cast");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [loadedCastImages, setLoadedCastImages] = useState({});
  const [failedCastImages, setFailedCastImages] = useState({});
  const [isBackdropReady, setIsBackdropReady] = useState(false);
  const [isFirstAirDateHovered, setIsFirstAirDateHovered] = useState(false);
  const [actorRatingsMap, setActorRatingsMap] = useState({});
  const [actorActionTarget, setActorActionTarget] = useState(null);
  const autoStatusSyncRef = useRef(false);
  const holdTimeoutRef = useRef(null);
  const isHoldingRef = useRef(false);

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
    const fetchShowDetails = async () => {
      try {
        const [showRes, castRes, imagesRes, reviewsRes] = await Promise.all([
          axios.get(
            `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/tv/${id}/aggregate_credits?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/tv/${id}/images?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
          axios.get(
            `https://api.themoviedb.org/3/tv/${id}/reviews?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
          ),
        ]);

        setShow(showRes.data);
        setCast(
          (castRes.data.cast || []).map((actor, index) => ({
            ...actor,
            character:
              Array.isArray(actor.roles) && actor.roles.length > 0
                ? actor.roles
                    .map((role) => role?.character)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ")
                : actor.character || null,
            _castKey:
              actor.credit_id ??
              actor.cast_id ??
              `${actor.id ?? "actor"}-${index}`,
          })),
        );
        setBackdrops(imagesRes.data.backdrops || []);
        setReviews(reviewsRes.data.results || []);
      } catch (err) {
        console.error("Failed to fetch show details", err);
      }
    };

    fetchShowDetails();
  }, [id]);

  useEffect(() => {
    if (!user?.email || !show) {
      setIsNotesLoading(false);
      return;
    }

    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
    );
    setIsNotesLoading(true);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const normalizedStatus =
          data.status === "Watched" ? "Finished" : data.status;
        setStatus(normalizedStatus);
        setFavourite(Boolean(data.favourite));
        const notes = String(data.notes || "");
        setSavedNotes(notes);
        setNotesDraft(notes);
        setWatchedEpisodes(
          Number.isFinite(Number(data.watchedEpisodes))
            ? Number(data.watchedEpisodes)
            : 0,
        );
        setSavedTotalEpisodes(
          Number.isFinite(Number(data.totalEpisodes))
            ? Number(data.totalEpisodes)
            : null,
        );
      } else {
        setStatus(null);
        setFavourite(false);
        setSavedNotes("");
        setNotesDraft("");
        setWatchedEpisodes(0);
        setSavedTotalEpisodes(null);
      }
      setIsNotesLoading(false);
    });

    return () => unsub();
  }, [user?.email, show, show?.id, activeProfileId]);

  useEffect(() => {
    if (!user?.email || !show?.id) {
      setUserRatingValue(0);
      return;
    }

    const ratingRef = doc(
      db,
      ...profileRatingItemPath(user.email, activeProfileId, "shows", show.id),
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
  }, [user?.email, show?.id, activeProfileId]);

  useEffect(() => {
    const fetchAwards = async (showData) => {
      try {
        const response = await axios.get(
          `https://www.omdbapi.com/?t=${showData.name}&apikey=${process.env.REACT_APP_OMDB_API_KEY}`,
        );
        setAwards(response.data.Awards);
      } catch (error) {
        console.error("Error fetching awards:", error);
      }
    };
    if (show) {
      fetchAwards(show);
    }
  }, [show]);

  useEffect(() => {
    if (!user?.email) return;

    const ref = collection(
      db,
      ...profileLikedActorsCollectionPath(user.email, activeProfileId),
    );
    const unsub = onSnapshot(ref, (snap) => {
      const ids = new Set(snap.docs.map((d) => Number(d.id)));
      setLikedActors(ids);
    });

    return () => unsub();
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    if (!user?.email) {
      setActorRatingsMap({});
      return;
    }

    const ref = collection(
      db,
      ...profileRatingsCollectionPath(user.email, activeProfileId, "actors"),
    );
    const unsub = onSnapshot(ref, (snap) => {
      const next = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        next[Number(data.id || entry.id)] = Number(data.value || 0);
      });
      setActorRatingsMap(next);
    });

    return () => unsub();
  }, [user?.email, activeProfileId]);

  useEffect(() => {
    setLoadedCastImages({});
    setFailedCastImages({});
  }, [cast]);

  useEffect(() => {
    if (!show?.backdrop_path) {
      setIsBackdropReady(true);
      return;
    }

    setIsBackdropReady(false);
    const preload = new Image();
    preload.src = `https://image.tmdb.org/t/p/w500/${show.backdrop_path}`;
    preload.onload = () => setIsBackdropReady(true);
    preload.onerror = () => setIsBackdropReady(true);
  }, [show?.backdrop_path]);

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

      toast.success(`${actor.name} removed from favourites`);
    } catch {
      toast.error("Failed to remove actor");
    }
  };

  const saveActorRating = async (actor, value) => {
    if (!user?.email || !actor?.id) {
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
      toast.error("Failed to save actor rating");
    }
  };

  const fetchTrailer = async (showId) => {
    try {
      const response = await axios.get(
        `https://api.themoviedb.org/3/tv/${showId}/videos?api_key=${process.env.REACT_APP_TMDB_API_KEY}`,
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

  const handleWatchLaterClick = () => {
    if (show) {
      fetchTrailer(show.id);
    }
  };

  const handleClose = () => {
    setTrailerUrl("");
  };

  const saveWithStatus = async (newStatus) => {
    if (!user?.email || !show) {
      toast.error("Login required");
      return;
    }

    if (status === newStatus) {
      toast(`Already marked as "${newStatus}"`, { icon: "i" });
      return;
    }

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
      );

      await setDoc(
        ref,
        {
          id: show.id,
          title: show.name,
          poster: show.poster_path ?? null,
          backdrop: show.backdrop_path ?? null,
          overview: show.overview,
          releaseDate: show.first_air_date ?? null,
          rating: show.vote_average,
          mediaType: "tv",
          status: newStatus,
          notInterested: false,
          dropReason: null,
          totalEpisodes: totalEpisodesNumber || null,
          totalSeasons:
            Number.isFinite(Number(show.number_of_seasons)) &&
            Number(show.number_of_seasons) > 0
              ? Number(show.number_of_seasons)
              : null,
          next_episode_to_air: show.next_episode_to_air ?? null,
          last_episode_to_air: show.last_episode_to_air ?? null,
          seasons: Array.isArray(show.seasons) ? show.seasons : [],
          watchedEpisodes:
            newStatus === "Finished" ? totalEpisodesNumber : watchedEpisodes,
          currentSeason:
            newStatus === "Finished"
              ? getSeasonEpisodeMeta(totalEpisodesNumber)?.season || null
              : watchedEpisodes > 0
                ? getSeasonEpisodeMeta(watchedEpisodes)?.season || null
                : null,
          currentEpisode:
            newStatus === "Finished"
              ? getSeasonEpisodeMeta(totalEpisodesNumber)?.episode || null
              : watchedEpisodes > 0
                ? getSeasonEpisodeMeta(watchedEpisodes)?.episode || null
                : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setStatus(newStatus);
      if (newStatus === "Finished") {
        setWatchedEpisodes(totalEpisodesNumber);
      }
      toast.success(`${show.name} marked as ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const removeFromList = async () => {
    if (!user?.email || !show) {
      toast.error("Login required");
      return;
    }

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
      );

      await deleteDoc(ref);
      setStatus(null);
      setFavourite(false);
      toast.success(`"${show.name}" removed from your list`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove from list");
    }
  };

  const toggleFavourite = async () => {
    if (!user?.email || !show) {
      toast.error("Login required");
      return;
    }
    if (isUnreleased) {
      toast("Favourites unlock on release", { icon: "🔒" });
      return;
    }

    const next = !favourite;
    const ref = doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
    );

    try {
      await setDoc(
        ref,
        {
          id: show.id,
          title: show.name,
          poster: show.poster_path ?? null,
          backdrop: show.backdrop_path ?? null,
          overview: show.overview,
          releaseDate: show.first_air_date ?? null,
          rating: show.vote_average,
          mediaType: "tv",
          status: status ?? null,
          notInterested: false,
          dropReason: null,
          totalEpisodes: totalEpisodesNumber || null,
          totalSeasons:
            Number.isFinite(Number(show.number_of_seasons)) &&
            Number(show.number_of_seasons) > 0
              ? Number(show.number_of_seasons)
              : null,
          next_episode_to_air: show.next_episode_to_air ?? null,
          last_episode_to_air: show.last_episode_to_air ?? null,
          seasons: Array.isArray(show.seasons) ? show.seasons : [],
          watchedEpisodes,
          currentSeason:
            watchedEpisodes > 0
              ? getSeasonEpisodeMeta(watchedEpisodes)?.season || null
              : null,
          currentEpisode:
            watchedEpisodes > 0
              ? getSeasonEpisodeMeta(watchedEpisodes)?.episode || null
              : null,
          favourite: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setFavourite(next);
      toast.success(
        next
          ? `${show.name} added to favourites`
          : `${show.name} removed from favourites`,
      );
    } catch {
      toast.error("Failed to update favourite");
    }
  };

  const isUnreleased =
    Boolean(show?.first_air_date) &&
    new Date(`${show.first_air_date}T00:00:00`).getTime() >
      new Date().setHours(0, 0, 0, 0);

  const savePersonalRating = async (value) => {
    if (!user?.email || !show?.id) {
      toast.error("Login required");
      return;
    }
    if (isUnreleased) {
      toast("Rating unlocks when this title releases.", { icon: "i" });
      return;
    }

    const clamped = Math.max(0, Math.min(5, Number(value) || 0));
    const ratingRef = doc(
      db,
      ...profileRatingItemPath(user.email, activeProfileId, "shows", show.id),
    );

    try {
      if (clamped === 0) {
        await deleteDoc(ratingRef);
        return;
      }

      await setDoc(
        ratingRef,
        {
          id: show.id,
          title: show.name,
          mediaType: "tv",
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

  const saveNotes = async (nextNotes = notesDraft) => {
    if (!user?.email || !show) {
      toast.error("Login required");
      return;
    }
    if (isNotesLoading) return;

    const normalizedNotes = String(nextNotes || "").trim();
    setIsSavingNotes(true);

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
      );

      await setDoc(
        ref,
        {
          id: show.id,
          title: show.name,
          poster: show.poster_path ?? null,
          backdrop: show.backdrop_path ?? null,
          overview: show.overview || null,
          releaseDate: show.first_air_date ?? null,
          rating: show.vote_average ?? null,
          mediaType: "tv",
          status: status ?? null,
          notInterested: false,
          dropReason: null,
          favourite: Boolean(favourite),
          totalEpisodes: totalEpisodesNumber || null,
          totalSeasons:
            Number.isFinite(Number(show.number_of_seasons)) &&
            Number(show.number_of_seasons) > 0
              ? Number(show.number_of_seasons)
              : null,
          next_episode_to_air: show.next_episode_to_air ?? null,
          last_episode_to_air: show.last_episode_to_air ?? null,
          seasons: Array.isArray(show.seasons) ? show.seasons : [],
          watchedEpisodes,
          notes: normalizedNotes,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setSavedNotes(normalizedNotes);
      setNotesDraft(normalizedNotes);
      toast.success(normalizedNotes ? "Notes saved" : "Notes cleared");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    if (
      !user?.email ||
      !show?.id ||
      status !== "Finished" ||
      autoStatusSyncRef.current
    ) {
      return;
    }

    const trackedEpisodes = Number(savedTotalEpisodes || 0);
    if (trackedEpisodes <= 0) return;

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

    const lastAiredSeasonNumber = Number(
      show.last_episode_to_air?.season_number,
    );
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
            return (
              !Number.isNaN(dt.getTime()) && dt.getTime() <= today.getTime()
            );
          })
          .map((season) => ({
            episodeCount: season.episodeCount,
          }));

    const hasSeasonAirDateInfo = seasonEpisodeCountsBase.some((season) =>
      Boolean(season.airDate),
    );
    const releasedEpisodeTotal = releasedSeasonEpisodeCounts.length
      ? releasedSeasonEpisodeCounts.reduce(
          (sum, season) => sum + season.episodeCount,
          0,
        )
      : !hasSeasonAirDateInfo &&
          Number.isFinite(Number(show.number_of_episodes)) &&
          Number(show.number_of_episodes) > 0
        ? Number(show.number_of_episodes)
        : 0;

    if (
      releasedEpisodeTotal <= trackedEpisodes ||
      watchedEpisodes < trackedEpisodes
    ) {
      return;
    }

    const syncStatusForNewEpisodes = async () => {
      autoStatusSyncRef.current = true;
      try {
        const ref = doc(
          db,
          ...profileSavedItemPath(
            user.email,
            activeProfileId,
            "shows",
            show.id,
          ),
        );

        await setDoc(
          ref,
          {
            status: "Watching",
            totalEpisodes: releasedEpisodeTotal,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        toast(`New episodes detected. Moved to "Watching".`, {
          icon: "i",
        });
      } catch {
        toast.error("Failed to sync status for new episodes");
      } finally {
        autoStatusSyncRef.current = false;
      }
    };

    syncStatusForNewEpisodes();
  }, [
    user?.email,
    show,
    status,
    savedTotalEpisodes,
    watchedEpisodes,
    activeProfileId,
  ]);

  if (!show) {
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

  const castSliderSettings = {
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

  const voteAverage = Number(show.vote_average || 0);
  const ratingPercent = Math.round(voteAverage * 10);
  const hasRating = Number(show.vote_count || 0) > 0 && voteAverage > 0;
  const scorePercentDisplay = hasRating ? `${ratingPercent}%` : "Not rated";
  const releaseYear = show.first_air_date
    ? show.first_air_date.substring(0, 4)
    : "N/A";
  const firstAirDateValue = String(show.first_air_date || "").trim();
  const parsedFirstAirDate = firstAirDateValue
    ? new Date(`${firstAirDateValue}T00:00:00`)
    : null;
  const hasValidFirstAirDate =
    parsedFirstAirDate instanceof Date &&
    !Number.isNaN(parsedFirstAirDate.getTime());
  const fullFirstAirDate = hasValidFirstAirDate
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(parsedFirstAirDate)
    : firstAirDateValue || releaseYear;
  const seasonsDisplay =
    typeof show.number_of_seasons === "number"
      ? String(show.number_of_seasons)
      : "N/A";
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
  const seasonEpisodeCounts = hasLastAiredEpisode
    ? seasonEpisodeCountsBase
        .filter((season) => season.seasonNumber <= lastAiredSeasonNumber)
        .map((season) => ({
          seasonNumber: season.seasonNumber,
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
          seasonNumber: season.seasonNumber,
          episodeCount: season.episodeCount,
        }));
  const hasSeasonAirDateInfo = seasonEpisodeCountsBase.some((season) =>
    Boolean(season.airDate),
  );
  const normalizedSeasonEpisodeCounts = seasonEpisodeCounts.length
    ? seasonEpisodeCounts
    : hasSeasonAirDateInfo
      ? []
      : seasonEpisodeCountsBase.map((season) => ({
          seasonNumber: season.seasonNumber,
          episodeCount: season.episodeCount,
        }));
  const upcomingSeasonReleases = Array.isArray(show.seasons)
    ? show.seasons
        .filter(
          (season) => Number(season?.season_number) > 0 && season?.air_date,
        )
        .map((season) => ({
          seasonNumber: Number(season.season_number),
          airDate: season.air_date,
        }))
        .filter((season) => {
          const dt = new Date(`${season.airDate}T00:00:00`);
          return !Number.isNaN(dt.getTime()) && dt.getTime() > today.getTime();
        })
        .sort((a, b) => a.airDate.localeCompare(b.airDate))
    : [];
  const nextUpcomingSeason = upcomingSeasonReleases[0] || null;
  const nextEpisodeAirDate = show.next_episode_to_air?.air_date || null;
  const nextEpisodeSeasonNumber = Number(
    show.next_episode_to_air?.season_number,
  );
  const upcomingSeasonDisplayDate =
    nextUpcomingSeason &&
    nextEpisodeAirDate &&
    nextEpisodeSeasonNumber === nextUpcomingSeason.seasonNumber
      ? nextEpisodeAirDate
      : nextUpcomingSeason?.airDate || null;
  const nextUpcomingSeasonDate = nextUpcomingSeason
    ? new Date(`${upcomingSeasonDisplayDate}T00:00:00`).toLocaleDateString(
        undefined,
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        },
      )
    : null;
  const seasonProgressTargets = normalizedSeasonEpisodeCounts.reduce(
    (acc, season) => {
      const prevTotal = acc.length ? acc[acc.length - 1].seasonEndEpisode : 0;
      acc.push({
        ...season,
        seasonEndEpisode: prevTotal + season.episodeCount,
      });
      return acc;
    },
    [],
  );
  const totalEpisodesFromSeasons = normalizedSeasonEpisodeCounts.reduce(
    (sum, season) => sum + season.episodeCount,
    0,
  );
  const totalEpisodesNumber =
    totalEpisodesFromSeasons > 0
      ? totalEpisodesFromSeasons
      : !hasSeasonAirDateInfo &&
          Number.isFinite(Number(show.number_of_episodes)) &&
          Number(show.number_of_episodes) > 0
        ? Number(show.number_of_episodes)
        : 0;
  const safeWatchedEpisodes = Math.min(
    Math.max(Number(watchedEpisodes) || 0, 0),
    totalEpisodesNumber || Number(watchedEpisodes) || 0,
  );
  const episodesLeft = totalEpisodesNumber
    ? Math.max(totalEpisodesNumber - safeWatchedEpisodes, 0)
    : 0;
  const progressPercent =
    totalEpisodesNumber > 0
      ? Math.round((safeWatchedEpisodes / totalEpisodesNumber) * 100)
      : 0;
  const runtimeMinutes =
    (Array.isArray(show.episode_run_time) &&
      show.episode_run_time.find((value) => Number(value) > 0)) ||
    (Number(show.last_episode_to_air?.runtime) > 0
      ? Number(show.last_episode_to_air.runtime)
      : null) ||
    (Number(show.next_episode_to_air?.runtime) > 0
      ? Number(show.next_episode_to_air.runtime)
      : null);
  const runtimeDisplay = runtimeMinutes
    ? `${runtimeMinutes} min`
    : "Not available";
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;
  const normalizedShowStatus = String(show.status || "").toLowerCase();
  const isEndedSeries = normalizedShowStatus === "ended";
  const isCancelledSeries =
    normalizedShowStatus === "cancelled" || normalizedShowStatus === "canceled";
  const airDateLabel = isEndedSeries
    ? "Last Air Date"
    : "Next Episode Air Date";
  const airDateValue = isEndedSeries
    ? show.last_air_date || "Unknown"
    : isCancelledSeries
      ? "Cancelled"
      : show.next_episode_to_air?.air_date || "TBA";

  const getSeasonEpisodeMeta = (episodeOrdinal) => {
    if (!normalizedSeasonEpisodeCounts.length || episodeOrdinal <= 0)
      return null;
    let consumed = 0;
    for (const season of normalizedSeasonEpisodeCounts) {
      const limit = consumed + season.episodeCount;
      if (episodeOrdinal <= limit) {
        return {
          season: season.seasonNumber,
          episode: episodeOrdinal - consumed,
          inSeasonTotal: season.episodeCount,
        };
      }
      consumed = limit;
    }
    const last =
      normalizedSeasonEpisodeCounts[normalizedSeasonEpisodeCounts.length - 1];
    return {
      season: last.seasonNumber,
      episode: last.episodeCount,
      inSeasonTotal: last.episodeCount,
    };
  };

  const markSeasonComplete = async (seasonNumber) => {
    const targetSeason = seasonProgressTargets.find(
      (season) => season.seasonNumber === seasonNumber,
    );

    if (!targetSeason) {
      toast.error("Season data unavailable");
      return;
    }

    if (safeWatchedEpisodes >= targetSeason.seasonEndEpisode) {
      toast(`Season ${seasonNumber} already marked complete`, { icon: "i" });
      return;
    }

    const clamped = updateEpisodeProgressLocal(targetSeason.seasonEndEpisode);
    await saveEpisodeProgress(clamped);
  };

  const currentEpisodeMeta = getSeasonEpisodeMeta(safeWatchedEpisodes);
  const nextEpisodeMeta =
    totalEpisodesNumber > 0 && safeWatchedEpisodes < totalEpisodesNumber
      ? getSeasonEpisodeMeta(safeWatchedEpisodes + 1)
      : null;

  const updateEpisodeProgressLocal = (nextWatchedEpisodes) => {
    const clamped = Math.max(
      0,
      Math.min(nextWatchedEpisodes, totalEpisodesNumber || nextWatchedEpisodes),
    );

    setWatchedEpisodes(clamped);
    return clamped; // important
  };

  const saveEpisodeProgress = async (clamped) => {
    if (!user?.email || !show) return;

    const nextStatus =
      totalEpisodesNumber > 0 && clamped >= totalEpisodesNumber
        ? "Finished"
        : status === "Finished"
          ? "Watching"
          : status || "Watching";

    try {
      const ref = doc(
        db,
        ...profileSavedItemPath(user.email, activeProfileId, "shows", show.id),
      );

      await setDoc(
        ref,
        {
          id: show.id,
          title: show.name,
          poster: show.poster_path ?? null,
          backdrop: show.backdrop_path ?? null,
          overview: show.overview,
          releaseDate: show.first_air_date ?? null,
          rating: show.vote_average,
          mediaType: "tv",
          totalEpisodes: totalEpisodesNumber || null,
          totalSeasons:
            Number.isFinite(Number(show.number_of_seasons)) &&
            Number(show.number_of_seasons) > 0
              ? Number(show.number_of_seasons)
              : null,
          next_episode_to_air: show.next_episode_to_air ?? null,
          last_episode_to_air: show.last_episode_to_air ?? null,
          seasons: Array.isArray(show.seasons) ? show.seasons : [],
          watchedEpisodes: clamped,
          currentSeason:
            clamped > 0 ? getSeasonEpisodeMeta(clamped)?.season || null : null,
          currentEpisode:
            clamped > 0 ? getSeasonEpisodeMeta(clamped)?.episode || null : null,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setStatus(nextStatus);
    } catch {
      toast.error("Failed to update episode progress");
    }
  };

  const startHold = (direction = 1) => {
    isHoldingRef.current = true;

    let delay = 300;
    let speedUp = 0.85;

    let current = safeWatchedEpisodes;

    const step = () => {
      current += direction;

      updateEpisodeProgressLocal(current);

      delay = Math.max(60, delay * speedUp);
      holdTimeoutRef.current = setTimeout(step, delay);
    };

    step();
  };

  const stopHold = () => {
    clearTimeout(holdTimeoutRef.current);
    saveEpisodeProgress(watchedEpisodes);

    setTimeout(() => {
      isHoldingRef.current = false;
    }, 0);
  };

  return (
    <div className="relative min-h-screen text-white bg-[#090909]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 overflow-hidden"
      >
        {show.backdrop_path ? (
          <img
            loading="lazy"
            className={`w-full h-full object-cover scale-110 blur-xl transition-opacity duration-700 ${
              isBackdropReady ? "opacity-100" : "opacity-0"
            }`}
            src={`https://image.tmdb.org/t/p/w500/${show.backdrop_path}`}
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
                  {show.poster_path ? (
                    <motion.img
                      src={`https://image.tmdb.org/t/p/w500/${show.poster_path}`}
                      alt={show.name}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="w-full h-[460px] object-cover rounded-2xl shadow-2xl shadow-black/60"
                    />
                  ) : (
                    <div className="w-full h-[460px] rounded-2xl bg-neutral-800 border border-white/10 flex items-center justify-center text-sm text-white/70">
                      No poster available
                    </div>
                  )}
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
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                      {show.name}
                    </h1>
                    {status && (
                      <button
                        onClick={() => setRemoveConfirmOpen(true)}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold transition bg-white/10 hover:bg-red-600/80 text-white"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <motion.span
                      layout
                      onHoverStart={() => setIsFirstAirDateHovered(true)}
                      onHoverEnd={() => setIsFirstAirDateHovered(false)}
                      transition={{
                        layout: { type: "spring", stiffness: 320, damping: 28 },
                      }}
                      className="px-3 py-1 rounded-full bg-white/10 text-neutral-200 overflow-hidden whitespace-nowrap inline-flex items-center"
                    >
                      <motion.span
                        initial={false}
                        animate={{
                          maxWidth:
                            isFirstAirDateHovered && hasValidFirstAirDate
                              ? 0
                              : 56,
                          opacity:
                            isFirstAirDateHovered && hasValidFirstAirDate
                              ? 0
                              : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 360,
                          damping: 30,
                        }}
                        className="inline-block overflow-hidden"
                      >
                        {releaseYear}
                      </motion.span>
                      <motion.span
                        initial={false}
                        animate={{
                          maxWidth:
                            isFirstAirDateHovered && hasValidFirstAirDate
                              ? 220
                              : 0,
                          opacity:
                            isFirstAirDateHovered && hasValidFirstAirDate
                              ? 1
                              : 0,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 28,
                        }}
                        className="inline-block overflow-hidden"
                      >
                        {fullFirstAirDate}
                      </motion.span>
                    </motion.span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
                      {seasonsDisplay} seasons
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-neutral-200">
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
                  {show.overview}
                </p>

                <div className="flex flex-wrap gap-2">
                  {(show.genres || []).map((genre) => (
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
                      Language
                    </p>
                    <p className="text-sm font-semibold text-white uppercase">
                      {show.original_language || "N/A"}
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
                      Status
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {show.status || "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      {airDateLabel}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {airDateValue}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-1">
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

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-400">
                        Episode Progress
                      </p>
                      <p className="text-sm font-semibold text-white mt-1">
                        {safeWatchedEpisodes} / {totalEpisodesNumber || "?"}{" "}
                        watched
                      </p>
                      <p className="text-xs text-white/65 mt-0.5">
                        {totalEpisodesNumber && nextEpisodeMeta
                          ? `Up next S${nextEpisodeMeta.season} • E${nextEpisodeMeta.episode}`
                          : totalEpisodesNumber
                            ? `Completed • ${episodesLeft} left • ${progressPercent}%`
                            : "Episode total unavailable"}
                      </p>
                      <p className="text-xs text-white/55 mt-0.5">
                        {currentEpisodeMeta
                          ? `Last watched S${currentEpisodeMeta.season} • E${currentEpisodeMeta.episode}`
                          : "No episodes marked yet"}
                      </p>
                      {nextUpcomingSeason && (
                        <p className="text-xs text-amber-300/90 mt-1">
                          {`Season ${nextUpcomingSeason.seasonNumber} coming ${nextUpcomingSeasonDate}`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const clamped = updateEpisodeProgressLocal(0);
                          saveEpisodeProgress(clamped);
                        }}
                        disabled={safeWatchedEpisodes <= 0}
                        title="Reset progress"
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <MdRestartAlt size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (isHoldingRef.current) return;

                          const next = safeWatchedEpisodes - 1;
                          const clamped = updateEpisodeProgressLocal(next);
                          saveEpisodeProgress(clamped);
                        }}
                        onMouseDown={() => startHold(-1)}
                        onMouseUp={stopHold}
                        onMouseLeave={stopHold}
                        onTouchStart={() => startHold(-1)}
                        onTouchEnd={stopHold}
                        disabled={safeWatchedEpisodes <= 0}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <button
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                        onClick={() => {
                          if (isHoldingRef.current) return;

                          const next = safeWatchedEpisodes + 1;
                          const clamped = updateEpisodeProgressLocal(next);
                          saveEpisodeProgress(clamped);
                        }}
                        onMouseDown={() => startHold(1)}
                        onMouseUp={stopHold}
                        onMouseLeave={stopHold}
                        onTouchStart={() => startHold(1)}
                        onTouchEnd={stopHold}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {seasonProgressTargets.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400 mb-2">
                        Quick mark full season
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {seasonProgressTargets.map((season) => {
                          const isComplete =
                            safeWatchedEpisodes >= season.seasonEndEpisode;

                          return (
                            <button
                              key={season.seasonNumber}
                              onClick={() =>
                                markSeasonComplete(season.seasonNumber)
                              }
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                                isComplete
                                  ? "bg-red-600/90 text-white"
                                  : "bg-white/10 hover:bg-white/20 text-white/85"
                              }`}
                            >
                              {`S${season.seasonNumber}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <PersonalRating
                  ratingType="stars"
                  value={userRatingValue}
                  starSizeClass="text-2xl"
                  onRate={(value) => {
                    setUserRatingValue(value);
                    savePersonalRating(value);
                  }}
                  disabled={!user?.email || isUnreleased}
                  disabledLabel={
                    !user?.email
                      ? "Sign in to rate this series."
                      : "This series is unreleased. Rating unlocks on release."
                  }
                  disabledToastMessage={
                    !user?.email
                      ? "Sign in to rate titles."
                      : "Rating unlocks on release"
                  }
                />

                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Personal Notes
                    </p>
                    {savedNotes && (
                      <button
                        onClick={() => saveNotes("")}
                        disabled={
                          !user?.email || isSavingNotes || isNotesLoading
                        }
                        className="text-[11px] px-2 py-1 rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    disabled={!user?.email || isSavingNotes || isNotesLoading}
                    rows={3}
                    placeholder="Add your thoughts, reminders, or watch notes..."
                    className="mt-2 w-full min-h-[50px] max-h-[200px] rounded-lg border border-transparent bg-black/40 px-3 py-2 text-sm text-white placeholder-white/45 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => saveNotes(notesDraft)}
                      disabled={
                        !user?.email ||
                        isSavingNotes ||
                        isNotesLoading ||
                        notesDraft === savedNotes
                      }
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isNotesLoading
                        ? "Loading..."
                        : isSavingNotes
                          ? "Saving..."
                          : "Save Notes"}
                    </button>
                  </div>
                </div>
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
                        {show?.name} Trailer
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

          <div
            className={`rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-6 max-h-[760px] flex flex-col overflow-hidden ${
              activeTab === "review"
                ? "h-[35vh] min-h-[30vh] md:h-[30vh] md:min-h-[30vh]"
                : "h-auto min-h-[340px] md:h-[30vh] md:min-h-[30vh]"
            }`}
          >
            <div className="flex flex-wrap justify-center gap-2">
              {["cast", "review", "screenshots", "awards"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`shrink-0 py-2 px-4 text-sm rounded-full capitalize transition ${
                    activeTab === tab
                      ? "bg-white text-black"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div
              className={`mt-6 flex-1 min-h-0 pr-1 ${
                activeTab === "cast" ? "overflow-y-hidden" : "overflow-y-auto"
              }`}
            >
              {activeTab === "cast" && (
                <div className="relative px-6 md:px-10">
                  <Slider {...castSliderSettings} key={cast.length}>
                    {cast.map((actor) => {
                      const actorRating = Number(
                        actorRatingsMap[actor.id] || 0,
                      );
                      const isLiked = likedActors.has(actor.id);
                      const actorReaction =
                        actorRating > 0
                          ? ACTOR_REACTION_EMOJIS[Math.max(0, actorRating - 1)]
                          : "Rate";
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
                          className="flex-shrink-0 w-full p-1.5"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center bg-[#131313] rounded-2xl overflow-hidden shadow-xl relative">
                            <div className="w-[88px] h-32 relative bg-neutral-800 overflow-hidden">
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
                                    onLoad={() => markCastImageLoaded(actor.id)}
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
                            <button
                              type="button"
                              onClick={() => setActorActionTarget(actor)}
                              className="absolute top-2 right-2 min-w-[42px] px-2 h-7 rounded-full bg-black/65 border border-white/25 text-[11px] text-white/90 hover:bg-black/85 transition"
                              title="Rate / Favourite actor"
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>{actorReaction}</span>
                                {isLiked ? (
                                  <>
                                    <span className="text-white/30 scale-110">
                                      |
                                    </span>
                                    <FaHeart
                                      className="text-red-500"
                                      size={10}
                                    />
                                  </>
                                ) : null}
                              </span>
                            </button>
                          </div>
                          <span className="text-sm text-gray-300 block mt-1">
                            as {actor.character ? `${actor.character}` : "TBA"}
                          </span>
                        </motion.div>
                      );
                    })}
                  </Slider>
                </div>
              )}

              {activeTab === "screenshots" && (
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
                            alt={show.name}
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
              )}

              {activeTab === "review" && (
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
              )}

              {activeTab === "awards" && (
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
      />

      <AnimatePresence>
        {actorActionTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setActorActionTarget(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#171717] to-[#101010] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            >
              <div className="h-1 bg-gradient-to-r from-red-500/80 via-red-400/50 to-transparent" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="w-11 h-14 rounded-md bg-cover bg-center bg-white/10 shrink-0 border border-white/10"
                      style={{
                        backgroundImage: `url(${
                          actorActionTarget.profile_path
                            ? `https://image.tmdb.org/t/p/w185/${actorActionTarget.profile_path}`
                            : NotFoundPlaceholder
                        })`,
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold truncate">
                        {actorActionTarget.name}
                      </h3>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                        Actor Actions
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActorActionTarget(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition"
                    aria-label="Close actor actions"
                  >
                    <IoMdClose size={17} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const isLiked = likedActors.has(actorActionTarget.id);
                    if (isLiked) {
                      removeActor(actorActionTarget);
                    } else {
                      saveActor(actorActionTarget);
                    }
                  }}
                  className={`mb-4 w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    likedActors.has(actorActionTarget.id)
                      ? "border-red-400/60 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                      : "border-white/20 bg-white/5 text-white/85 hover:bg-white/10"
                  }`}
                >
                  {likedActors.has(actorActionTarget.id)
                    ? "Remove Favourite"
                    : "Add to Favourites"}
                </button>

                <PersonalRating
                  ratingType="emoji"
                  value={Number(actorRatingsMap[actorActionTarget.id] || 0)}
                  onRate={(value) => saveActorRating(actorActionTarget, value)}
                  modeHint="Rate this actor"
                  disabled={!user?.email}
                  disabledLabel="Sign in to rate actors."
                  disabledToastMessage="Sign in to rate actors."
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {removeConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#111] p-5">
            <h3 className="text-lg font-semibold mb-2">Remove from list?</h3>
            <p className="text-sm text-white/70">
              Remove <span className="text-white">{show.name}</span> from your
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

export default ShowDetails;
