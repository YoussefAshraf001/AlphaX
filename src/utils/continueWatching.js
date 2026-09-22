export const isContinueWatchingVisible = (item) =>
  (item.status === "Watching" ||
    ((item.status === "Finished" || item.status === "Watched") &&
      item.playback &&
      !item.playback.completed &&
      Number(item.playback.currentTime || 0) > 0)) &&
  (!item.continueWatchingHiddenAtMs ||
    Number(item.playback?.updatedAtMs || 0) > item.continueWatchingHiddenAtMs);
