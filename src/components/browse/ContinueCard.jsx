import { useNavigate } from "react-router-dom";

const ContinueCard = ({ item }) => {
  const navigate = useNavigate();

  const progress = Math.min(Math.max(item.progress ?? 0.2, 0.05), 0.95);

  const handleClick = () => {
    if (item.mediaType === "tv") {
      navigate(`/shows/${item.id}`);
    } else {
      navigate(`/movies/${item.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative min-w-[220px] cursor-pointer group"
    >
      <img
        src={`https://image.tmdb.org/t/p/w500/${item.img}`}
        alt={item.title}
        className="rounded-md object-cover"
      />

      {/* DARK OVERLAY */}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition" />

      {/* TITLE */}
      <div className="absolute bottom-6 left-3 right-3 text-sm font-medium text-white truncate">
        {item.title}
      </div>

      {/* PROGRESS BAR */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700">
        <div
          className="h-full bg-red-600"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
};

export default ContinueCard;
