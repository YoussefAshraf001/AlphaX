export function playbackUpdate(previous = {}, sample) {
  const currentTime = Math.max(0, Number(sample.currentTime) || 0);
  const duration = Math.max(0, Number(sample.duration) || 0);
  const key = sample.type === "tv" ? `s${sample.season}e${sample.episode}` : "movie";
  const episodeProgress = { ...(previous.episodeProgress || {}) };
  const wasCompleted = Boolean(episodeProgress[key]?.completed);
  const preserveResume = previous.playback && ((sample.manual && (previous.playback.season !== sample.season || previous.playback.episode !== sample.episode)) || (sample.savedAt && previous.playback.updatedAtMs > sample.savedAt));
  const reachedEnd = sample.completed ?? (sample.event === "ended" || (duration > 0 && currentTime / duration >= 0.95));
  // Completion is permanent for watch-history counts, while playback can still
  // hold a fresh resume point when a finished title is being rewatched.
  const completed = wasCompleted || reachedEnd;
  episodeProgress[key] = { currentTime, duration, completed, season: sample.season || 0, episode: sample.episode || 0, updatedAtMs: sample.savedAt || 0 };
  const completedCount = Object.values(episodeProgress).filter((item) => item.completed).length;
  return {
    episodeProgress,
    episodeProgressVersion: 1,
    playback: preserveResume ? previous.playback : { ...episodeProgress[key], completed: reachedEnd, currentTime: reachedEnd ? 0 : currentTime },
    watchedEpisodes: sample.type === "tv" ? Math.max(completedCount, (Number(previous.watchedEpisodes) || 0) + (completed && !wasCompleted ? 1 : !completed && wasCompleted ? -1 : 0)) : 0,
    watchTimeSeconds: Math.max(0, Number(previous.watchTimeSeconds) || 0) + Math.max(0, Number(sample.watchTimeSeconds) || 0),
    currentSeason: preserveResume ? previous.currentSeason || previous.playback.season || 0 : sample.season || 0,
    currentEpisode: preserveResume ? previous.currentEpisode || previous.playback.episode || 0 : sample.episode || 0,
    status: previous.status === "Finished" || previous.status === "Watched"
      ? "Finished"
      : sample.type === "movie" && completed
        ? "Finished"
        : "Watching",
  };
}

export function normalizePlayerEvent(message, fallback) {
  try {
    const envelope = typeof message === "string" ? JSON.parse(message) : message;
    const data = envelope?.type === "PLAYER_EVENT" ? envelope.data : envelope;
    if (!data || !["play", "timeupdate", "pause", "ended"].includes(data.event) || !Number.isFinite(data.currentTime) || data.currentTime < 0) return null;
    if (data.id != null && String(data.id) !== String(fallback.id)) return null;
    const season = fallback.type === "tv" ? Number(data.season ?? fallback.season) : 0;
    const episode = fallback.type === "tv" ? Number(data.episode ?? fallback.episode) : 0;
    if (fallback.type === "tv" && (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1)) return null;
    return { event: data.event, currentTime: data.currentTime, duration: Number.isFinite(data.duration) && data.duration >= 0 ? data.duration : 0, season, episode };
  } catch { return null; }
}

export function playbackSummary(item) {
  const playback = item.playback;
  if (!playback) return { percent: 0, label: item.mediaType === "tv" ? `${Number(item.watchedEpisodes) || 0} episodes watched` : "Ready to watch" };
  const prefix = item.mediaType === "tv" ? `S${playback.season} · E${playback.episode} · ` : "";
  if (playback.completed) return { percent: 100, label: `${prefix}Watched` };
  const percent = playback.duration > 0 ? Math.min(100, Math.max(0, playback.currentTime / playback.duration * 100)) : 0;
  const time = playback.duration > 0 ? `${Math.max(0, Math.ceil((playback.duration - playback.currentTime) / 60))} min left` : `${Math.floor(playback.currentTime / 60)} min watched`;
  return { percent, label: prefix + time };
}
