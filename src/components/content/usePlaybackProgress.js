import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { profileSavedItemPath } from "../../utils/profileFirestorePaths";
import { playbackUpdate } from "../../utils/playbackProgress";
import { migrateEpisodeCompletion } from "../../utils/episodeCompletion";
import { checkpointKey, readCheckpoint, writeCheckpoint, acknowledgeCheckpoint, applyCheckpoint, sampleKey } from "../../utils/playbackCheckpoint";

export default function usePlaybackProgress({ media, type, email, profileId }) {
  const [saved, setSaved] = useState(null);
  const [ready, setReady] = useState(!email);
  const [error, setError] = useState("");
  const pending = useRef(null);
  const chain = useRef(Promise.resolve());
  const lastWrite = useRef(0);
  const lastEvent = useRef(null);
  const replayed = useRef(false);
  const localKey = checkpointKey(email, profileId, type, media.id);
  const metadata = useMemo(() => ({ id: media.id, title: media.title || media.name, poster: media.poster_path || null, backdrop: media.backdrop_path || null, overview: media.overview || "", mediaType: type, releaseDate: media.release_date || media.first_air_date || null }), [media, type]);
  const reference = useMemo(() => email ? doc(db, ...profileSavedItemPath(email, profileId, type === "tv" ? "shows" : "movies", media.id)) : null, [email, profileId, type, media.id]);

  const persist = useCallback((sample) => {
    if (!reference) return;
    chain.current = chain.current.then(() => runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const previous = type === "tv" ? migrateEpisodeCompletion(snapshot.exists() ? snapshot.data() : {}, media) : snapshot.exists() ? snapshot.data() : {};
      if ((previous.episodeProgress?.[sampleKey(sample)]?.updatedAtMs || 0) >= sample.savedAt) return;
      const update = playbackUpdate(previous, sample);
      transaction.set(reference, {
        ...update, ...metadata,
        lastWatchedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });
    })).then(() => { acknowledgeCheckpoint(localKey, sample); setError(""); }).catch(() => {
      // Keep the latest position queued for the next save attempt.
      if (!pending.current) pending.current = sample;
      setError("Watch progress could not sync. Your next save will retry.");
    });
  }, [reference, metadata, localKey, media, type]);

  const flush = useCallback(() => {
    const sample = pending.current;
    if (!sample || !reference) return;
    pending.current = null;
    lastWrite.current = Date.now();
    persist(sample);
  }, [reference, persist]);

  useEffect(() => {
    if (!reference) { setReady(true); return; }
    return onSnapshot(reference, (snapshot) => {
      const checkpoint = readCheckpoint(localKey);
      const previous = snapshot.exists() ? snapshot.data() : {};
      setSaved(applyCheckpoint(type === "tv" ? migrateEpisodeCompletion(previous, media) : previous, checkpoint));
      setReady(true);
      if (!replayed.current) {
        replayed.current = true;
        Object.values(checkpoint?.samples || {}).sort((a, b) => a.savedAt - b.savedAt).forEach(persist);
      }
    }, () => { setSaved(applyCheckpoint({}, readCheckpoint(localKey))); setError("Could not load cloud progress. Using this browser's checkpoint."); setReady(true); });
  }, [reference, localKey, persist, media, type]);

  const record = useCallback((sample) => {
    if (!reference || !ready) return;
    const now = Date.now();
    const key = `${sample.season || 0}:${sample.episode || 0}`;
    const previous = lastEvent.current;
    const delta = previous?.key === key && previous.playing ? Math.max(0, Math.min((now - previous.at) / 1000, sample.currentTime - previous.position, 15)) : 0;
    lastEvent.current = { key, at: now, position: sample.currentTime, playing: !["pause", "ended"].includes(sample.event) };
    if (pending.current && `${pending.current.season || 0}:${pending.current.episode || 0}` !== key) flush();
    pending.current = { ...sample, type, savedAt: now, watchTimeSeconds: (pending.current?.watchTimeSeconds || 0) + delta };
    writeCheckpoint(localKey, metadata, pending.current);
    setSaved((current) => applyCheckpoint(current || {}, readCheckpoint(localKey)));
    if (previous?.key !== key || sample.event === "play" || sample.event === "pause" || sample.event === "ended" || sample.completed !== undefined || now - lastWrite.current >= 5000) flush();
  }, [reference, ready, type, flush, localKey, metadata]);

  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", flush);
    return () => { flush(); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", flush); };
  }, [flush]);

  return { saved, ready, error, record, flush };
}
