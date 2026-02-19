import { useNavigate } from "react-router-dom";
import { IoAdd } from "react-icons/io5";
import { IoIosPause, IoIosClose } from "react-icons/io";
import { FaHeart, FaPlay, FaRegHeart, FaTrash } from "react-icons/fa";
import { MdDoneOutline } from "react-icons/md";
import NotFoundPlaceholder from "../../assets/notFound-Placeholder.jpg";

/* =========================
   STATUS CONFIG
========================= */
const STATUS_ACTIONS = [
  { key: "Want to Watch", icon: IoAdd },
  { key: "Watching", icon: FaPlay },
  { key: "Finished", icon: MdDoneOutline },
  { key: "Paused", icon: IoIosPause },
  { key: "Dropped", icon: IoIosClose },
];

const STATUS_MAP = {
  want: "Want to Watch",
  "want to watch": "Want to Watch",
  watching: "Watching",
  watched: "Finished",
  finished: "Finished",
  paused: "Paused",
  dropped: "Dropped",
};

const normalizeStatus = (status) => {
  if (!status) return null;
  return STATUS_MAP[String(status).trim().toLowerCase()] ?? status;
};

/* =========================
   COMPONENT
========================= */
const PosterCard = ({ item, onStatusChange, onFavouriteToggle }) => {
  const navigate = useNavigate();
  const currentStatus = normalizeStatus(item.status);
  const isSaved = Boolean(item.isSaved || currentStatus);
  const isFavourite = Boolean(item.favourite);
  const isFavouriteLocked = Boolean(item.isUnreleased);

  const poster = item.poster_path || item.poster;
  const isTV = !!item.first_air_date;

  const year =
    item.releaseDate?.slice(0, 4) ||
    item.release_date?.slice(0, 4) ||
    item.first_air_date?.slice(0, 4) ||
    "";
  const yearLabel = item.releaseDateLabel || year || (item.isUnreleased ? "TBA" : "");
  const detailPath = isTV ? `/shows/${item.id}` : `/movies/${item.id}`;

  const handleOpenDetails = (event) => {
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(detailPath, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(detailPath);
  };

  return (
    <div
      onClick={handleOpenDetails}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          handleOpenDetails(e);
        }
      }}
      className="
        group relative
        w-[210px] h-[320px]
        rounded-xl overflow-hidden
        bg-black
        cursor-pointer
      "
    >
      {/* IMAGE (ZOOMS, NOT CARD) */}
      {poster ? (
        <img
          src={`https://image.tmdb.org/t/p/w500/${poster}`}
          alt={item.title || item.name}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = NotFoundPlaceholder;
          }}
          className="
            absolute inset-0 w-full h-full object-cover
            transition-transform duration-300 ease-out
            group-hover:scale-[1.08]
            group-hover:brightness-[0.55]
          "
        />
      ) : (
        <div
          className="
            absolute inset-0
            bg-gradient-to-b from-neutral-700 to-neutral-900
            transition duration-300
            group-hover:brightness-[0.65]
          "
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70 tracking-wide">
            {item.isUnreleased ? "In Production" : "No Poster"}
          </div>
        </div>
      )}

      {/* TITLE (MOVES UP) */}
      <div
        className="
          absolute left-3 right-3 bottom-3
          text-sm font-semibold text-white
          leading-tight line-clamp-2
          transition-all duration-200
          group-hover:bottom-[85px]
          z-20
        "
      >
        {item.title || item.name}
      </div>

      {/* META */}
      <div
        className="
          absolute left-3 right-3 bottom-16
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          z-20
        "
      >
        {yearLabel && <div className="text-xs text-white/70">{yearLabel}</div>}
      </div>

      {/* STATUS BUTTONS */}
      <div
        className="
          absolute inset-x-3 bottom-3
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          z-30
        "
      >
        <div className="flex justify-center gap-2 px-2 py-2 rounded-xl bg-black/70 backdrop-blur">
          {STATUS_ACTIONS.map(({ key, icon: Icon }) => {
            const isActive = currentStatus === key;

            return (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange?.(item, key);
                }}
                title={key}
                className={`
        w-8 h-8 rounded-full
        flex items-center justify-center
        transition
        ${
          isActive
            ? "bg-red-500 scale-110 shadow-lg"
            : "bg-white/10 hover:bg-white/20"
        }
      `}
              >
                <Icon size={14} className="text-white" />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isFavouriteLocked) {
            onFavouriteToggle?.(item, isFavourite);
            return;
          }
          onFavouriteToggle?.(item, !isFavourite);
        }}
        title={
          isFavouriteLocked
            ? "Favourites unlock on release"
            : isFavourite
              ? "Remove favourite"
              : "Add favourite"
        }
        className={`
          absolute top-3 left-3 z-30
          w-8 h-8 rounded-full
          flex items-center justify-center
          transition
          ${
            isFavouriteLocked
              ? "bg-black/45 text-white/45 cursor-not-allowed"
              : isFavourite
              ? "bg-red-600/90"
              : "bg-black/60 hover:bg-black/80 opacity-0 group-hover:opacity-100"
          }
        `}
      >
        {isFavourite ? (
          <FaHeart size={12} className="text-white" />
        ) : (
          <FaRegHeart size={12} className="text-white" />
        )}
      </button>

      {isSaved && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange?.(item, null);
          }}
          title="Remove from list"
          className="
            absolute top-3 right-3 z-30
            w-8 h-8 rounded-full
            flex items-center justify-center
            bg-black/60 hover:bg-red-600/80
            opacity-0 group-hover:opacity-100
            transition
          "
        >
          <FaTrash size={12} className="text-white" />
        </button>
      )}
    </div>
  );
};

export default PosterCard;
