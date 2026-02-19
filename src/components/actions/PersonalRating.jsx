import toast from "react-hot-toast";

const EMOJI_SCALE = [
  "\u{1F621}",
  "\u{1F615}",
  "\u{1F610}",
  "\u{1F642}",
  "\u{1F60D}",
];
const STAR_FILLED = "\u2605";
const STAR_EMPTY = "\u2606";

const PersonalRating = ({
  value = 0,
  ratingType = "stars",
  onRate,
  disabled = false,
  disabledLabel = "",
  modeHint = "",
  starSizeClass = "text-3xl",
  className = "",
  disabledToastMessage = "",
}) => {
  const effectiveMode = ratingType === "emoji" ? "emoji" : "stars";
  const normalizedValue = Math.max(0, Math.min(5, Number(value) || 0));

  const showLockedToast = () => {
    toast(disabledToastMessage || "Rating unlocks on release");
  };

  const renderStars = () => (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => {
        const isEmoji = effectiveMode === "emoji";
        const isActive = isEmoji ? n === normalizedValue : n <= normalizedValue;
        const hasSelection = normalizedValue > 0;
        const nonSelectedClass =
          hasSelection && !isActive
            ? isEmoji
              ? "opacity-20 scale-85"
              : "opacity-35 scale-90"
            : "";

        return (
          <button
            key={n}
            onClick={() => {
              if (disabled) {
                showLockedToast();
                return;
              }
              onRate?.(n);
            }}
            aria-disabled={disabled}
            className={`${starSizeClass} leading-none transition duration-200 ${
              disabled
                ? "opacity-45 cursor-not-allowed scale-95"
                : isActive
                  ? "opacity-100 scale-125"
                  : nonSelectedClass
                    ? nonSelectedClass
                    : "opacity-90 hover:scale-110"
            } ${!isEmoji && isActive ? "text-yellow-300" : ""} ${
              !isEmoji && !isActive ? "text-white/40" : ""
            }`}
            title={`Rate ${n}`}
          >
            {isEmoji ? EMOJI_SCALE[n - 1] : isActive ? STAR_FILLED : STAR_EMPTY}
          </button>
        );
      })}
    </div>
  );

  const renderClear = () => (
    <button
      onClick={() => {
        if (disabled) {
          showLockedToast();
          return;
        }
        onRate?.(0);
      }}
      aria-disabled={disabled}
      className={`text-[11px] px-2 py-1 rounded-full border border-white/20 bg-white/10 text-white/80 transition ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"
      }`}
    >
      Clear
    </button>
  );

  return (
    <div
      className={`relative rounded-xl border border-white/10 bg-white/5 p-3 md:p-3.5 ${className}`}
    >
      <div className="absolute top-3 right-3">{renderClear()}</div>
      <p className="text-[11px] uppercase tracking-wide text-white/60 text-center">
        Your Rating
      </p>
      {modeHint ? (
        <p className="mt-1 text-[11px] text-white/40 italic text-center">
          {modeHint}
        </p>
      ) : null}

      <div className="mt-2 relative min-h-[2rem] flex items-center justify-center">
        {renderStars()}
      </div>

      {disabled && (
        <p className="mt-2 text-[11px] text-yellow-300/85 text-center">
          {disabledLabel || "Rating opens after release."}
        </p>
      )}
    </div>
  );
};

export default PersonalRating;
