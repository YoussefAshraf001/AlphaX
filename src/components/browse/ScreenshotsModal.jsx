import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { FiDownload } from "react-icons/fi";

const ScreenshotsModal = ({
  isOpen,
  onClose,
  images = [],
  currentIndex = 0,
  setCurrentIndex,
}) => {
  const dialogRef = useRef(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [loadedIndexes, setLoadedIndexes] = useState({});
  const [mainImageError, setMainImageError] = useState(false);

  // --- Guards ---
  const total = images.length;
  const safeIndex = Math.min(Math.max(currentIndex, 0), total - 1);
  const getDisplayImageUrl = useCallback(
    (index) => `https://image.tmdb.org/t/p/w1280/${images[index].file_path}`,
    [images],
  );
  const getOriginalImageUrl = (index) =>
    `https://image.tmdb.org/t/p/original/${images[index].file_path}`;

  const imageUrl = total > 0 ? getDisplayImageUrl(safeIndex) : null;

  const canGoPrev = safeIndex > 0;
  const canGoNext = safeIndex < total - 1;

  const handleDownload = async () => {
    if (!images.length) return;

    const image = images[safeIndex];
    if (!image?.file_path) return;

    const imageUrl = getOriginalImageUrl(safeIndex);

    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `screenshot_${safeIndex + 1}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };

  // --- Reset loading state when image changes ---
  useEffect(() => {
    setIsImageLoaded(Boolean(loadedIndexes[safeIndex]));
    setMainImageError(false);

    // Preload adjacent screenshots to reduce next/prev wait.
    const preloadIndexes = [safeIndex - 1, safeIndex + 1].filter(
      (i) => i >= 0 && i < total,
    );

    preloadIndexes.forEach((index) => {
      const img = new Image();
      img.src = getDisplayImageUrl(index);
    });
  }, [safeIndex, total, loadedIndexes, getDisplayImageUrl]);

  // --- Scroll lock ---
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // --- Keyboard support ---
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && canGoNext) setCurrentIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && canGoPrev) setCurrentIndex((i) => i - 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    canGoNext,
    canGoPrev,
    onClose,
    setCurrentIndex, // ✅ ADD THIS
  ]);

  if (!isOpen || total === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="
          relative
          w-full
          max-w-[85vw]
          md:max-w-[75vw]
          lg:max-w-[65vw]
        "
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-20 bg-black/70 hover:bg-black text-white p-2 rounded-full"
        >
          <IoMdClose size={18} />
        </button>

        {/* Prev */}
        <button
          disabled={!canGoPrev}
          onClick={() => setCurrentIndex((i) => i - 1)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full
            ${
              canGoPrev
                ? "bg-black/60 hover:bg-black text-white"
                : "opacity-30 cursor-not-allowed"
            }
          `}
        >
          <FaChevronLeft />
        </button>

        {/* Image container (FIXED SIZE) */}
        <div className="relative flex items-center justify-center h-[70vh] bg-black rounded-lg overflow-hidden">
          {/* Skeleton */}
          {!isImageLoaded && !mainImageError && (
            <div className="absolute inset-0 animate-pulse bg-gray-800" />
          )}

          {mainImageError && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Failed to load image.
            </div>
          )}

          {/* Image */}
          <AnimatePresence>
            {imageUrl && (
              <motion.img
                key={imageUrl}
                src={imageUrl}
                alt=""
                loading="eager"
                decoding="async"
                onLoad={() => {
                  setIsImageLoaded(true);
                  setLoadedIndexes((prev) => ({ ...prev, [safeIndex]: true }));
                }}
                onError={() => {
                  setMainImageError(true);
                  setIsImageLoaded(true);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: isImageLoaded && !mainImageError ? 1 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="max-h-full max-w-full object-contain relative z-10"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Next */}
        <button
          disabled={!canGoNext}
          onClick={() => setCurrentIndex((i) => i + 1)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full
            ${
              canGoNext
                ? "bg-black/60 hover:bg-black text-white"
                : "opacity-30 cursor-not-allowed"
            }
          `}
        >
          <FaChevronRight />
        </button>

        {/* Thumbnails */}
        <div className="flex gap-2 mt-4 overflow-x-auto px-2 justify-center">
          {images.map((img, index) => (
            <button
              key={img.file_path}
              onClick={() => setCurrentIndex(index)}
              className={`border-2 rounded overflow-hidden transition
                ${
                  index === safeIndex
                    ? "border-white"
                    : "border-transparent opacity-50 hover:opacity-80"
                }
              `}
            >
              <img
                src={`https://image.tmdb.org/t/p/w200/${img.file_path}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-14 object-cover"
              />
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-3 z-20 flex gap-2">
          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!isImageLoaded}
            aria-label="Download image"
            className={`
      bg-black/70 hover:bg-black text-white
      p-2 rounded-full transition
      ${!isImageLoaded ? "opacity-50 cursor-not-allowed" : ""}
    `}
          >
            <FiDownload size={18} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="bg-black/70 hover:bg-black text-white p-2 rounded-full transition"
          >
            <IoMdClose size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotsModal;
