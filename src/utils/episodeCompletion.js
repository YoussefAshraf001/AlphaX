// Details counts represent a chronological prefix of regular episodes.
export function completionFromCount(previous, seasons, count, updatedAtMs = Date.now()) {
  const episodeProgress = { ...(previous.episodeProgress || {}) };
  let ordinal = 0;
  for (const season of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
    for (let episode = 1; episode <= season.episodeCount; episode += 1) {
      const key = `s${season.seasonNumber}e${episode}`;
      ordinal += 1;
      episodeProgress[key] = { currentTime: 0, duration: 0, ...episodeProgress[key], season: season.seasonNumber, episode, completed: ordinal <= count, updatedAtMs };
    }
  }
  const update = { episodeProgress, watchedEpisodes: Math.min(Math.max(0, count), ordinal), episodeProgressVersion: 1 };
  if (previous.playback) {
    const current = episodeProgress[`s${previous.playback.season}e${previous.playback.episode}`];
    if (current) update.playback = { ...previous.playback, completed: current.completed, currentTime: current.completed ? 0 : current.currentTime, updatedAtMs };
  }
  return update;
}

export function migrateEpisodeCompletion(saved, media) {
  if (!saved || saved.episodeProgressVersion === 1 || !(saved.watchedEpisodes > 0)) return saved;
  const last = media.last_episode_to_air;
  const seasons = (media.seasons || []).filter((season) => season.season_number > 0 && (!last || season.season_number <= last.season_number)).map((season) => ({ seasonNumber: season.season_number, episodeCount: last?.season_number === season.season_number ? Math.min(season.episode_count, last.episode_number) : season.episode_count }));
  if (!seasons.length) return saved;
  return { ...saved, ...completionFromCount(saved, seasons, saved.watchedEpisodes, saved.updatedAt?.toMillis?.() || (saved.updatedAt?.seconds || 0) * 1000) };
}
