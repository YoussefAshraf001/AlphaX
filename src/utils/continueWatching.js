export const isContinueWatchingVisible = (item) =>
  item.status === "Watching" &&
  (!item.continueWatchingHiddenAtMs ||
    Number(item.playback?.updatedAtMs || 0) > item.continueWatchingHiddenAtMs);
