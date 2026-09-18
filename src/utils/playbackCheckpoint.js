import { playbackUpdate } from "./playbackProgress";
export const CHECKPOINT_EVENT = "alphax-playback-checkpoint";
export const checkpointPrefix = (email, profileId) => `alphax:playback:${encodeURIComponent(email)}:${encodeURIComponent(profileId)}:`;
export const checkpointKey = (email, profileId, type, id) => email ? `${checkpointPrefix(email, profileId)}${type}:${id}` : null;
export const sampleKey = (sample) => sample.type === "tv" ? `s${sample.season}e${sample.episode}` : "movie";
export function readCheckpoint(key) {
  try { return key ? JSON.parse(localStorage.getItem(key)) : null; } catch { return null; }
}
export function writeCheckpoint(key, metadata, sample) {
  if (!key) return;
  const checkpoint = readCheckpoint(key) || { metadata, samples: {} };
  checkpoint.metadata = metadata;
  checkpoint.samples[sampleKey(sample)] = { ...sample, watchTimeSeconds: 0 };
  try { localStorage.setItem(key, JSON.stringify(checkpoint)); window.dispatchEvent(new Event(CHECKPOINT_EVENT)); } catch { /* Cloud saving remains available when browser storage is disabled. */ }
}
export function acknowledgeCheckpoint(key, sample) {
  const checkpoint = readCheckpoint(key);
  const entry = checkpoint?.samples?.[sampleKey(sample)];
  if (!entry || entry.savedAt > sample.savedAt) return;
  delete checkpoint.samples[sampleKey(sample)];
  try {
    if (Object.keys(checkpoint.samples).length) localStorage.setItem(key, JSON.stringify(checkpoint));
    else localStorage.removeItem(key);
    window.dispatchEvent(new Event(CHECKPOINT_EVENT));
  } catch { /* A retained checkpoint is reconciled by timestamp. */ }
}
export function applyCheckpoint(previous = {}, checkpoint) {
  let result = { ...checkpoint?.metadata, ...previous };
  for (const sample of Object.values(checkpoint?.samples || {}).sort((a, b) => a.savedAt - b.savedAt)) {
    if (sample.savedAt <= (result.episodeProgress?.[sampleKey(sample)]?.updatedAtMs || 0)) continue;
    result = { ...result, ...playbackUpdate(result, sample), lastWatchedAt: { seconds: sample.savedAt / 1000 } };
  }
  return result;
}
export function profileCheckpoints(email, profileId) {
  const result = [];
  try {
    const prefix = checkpointPrefix(email, profileId);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) { const entry = readCheckpoint(key); if (entry) result.push(entry); }
    }
  } catch { /* Browser storage may be unavailable. */ }
  return result;
}
