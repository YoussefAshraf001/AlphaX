import { useEffect, useMemo, useState } from "react";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { UserAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { toast } from "react-hot-toast";
import {
  profileSavedItemPath,
  resolveProfileId,
} from "../../utils/profileFirestorePaths";

import { IoTimeOutline } from "react-icons/io5";
import { FaPlay } from "react-icons/fa";
import { FaCheck } from "react-icons/fa";
import { motion } from "framer-motion";

const STATUS_CONFIG = {
  "Want to Watch": {
    icon: IoTimeOutline,
  },
  Watching: {
    icon: FaPlay,
  },
  Finished: {
    icon: FaCheck,
  },
  Paused: {
    icon: FaCheck,
  },
  Dropped: {
    icon: FaCheck,
  },
};

const normalizeSavedStatus = (status) =>
  status === "Watched" ? "Finished" : status;

const StatusButtons = ({ item }) => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const isTV = item.media_type === "tv";
  const typeDoc = isTV ? "shows" : "movies";
  const activeProfileId = resolveProfileId(selectedProfile);

  const ref = useMemo(() => {
    if (!user?.email || !item?.id) return null;
    return doc(
      db,
      ...profileSavedItemPath(user.email, activeProfileId, typeDoc, item.id),
    );
  }, [activeProfileId, item?.id, typeDoc, user?.email]);

  /* ---------------- FETCH CURRENT STATUS ---------------- */
  useEffect(() => {
    if (!ref) {
      setCurrentStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchStatus = async () => {
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCurrentStatus(normalizeSavedStatus(snap.data().status));
        } else {
          setCurrentStatus(null);
        }
      } catch (err) {
        console.error("Failed to fetch status", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [ref]);

  /* ---------------- SET STATUS ---------------- */
  const setStatus = async (status) => {
    if (!user?.email || !ref) {
      toast.error("Login required");
      return;
    }

    setCurrentStatus(status);

    try {
      await setDoc(
        ref,
        {
          id: item.id,
          title: item.title || item.name,
          poster: item.poster_path || null,
          backdrop: item.backdrop_path || null,
          status,
          mediaType: isTV ? "tv" : "movie",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast.success(`Marked as ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 w-32 bg-white/10 rounded-full animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center bg-white/5 rounded-full p-1 mt-3">
      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
        const Icon = cfg.icon;
        const isActive = currentStatus === status;

        return (
          <button
            key={status}
            onClick={() => setStatus(status)}
            className="
          relative z-10 flex items-center gap-2
          px-4 py-2 text-sm rounded-full
          text-white/70 hover:text-white
          transition
        "
          >
            {/* Active background */}
            {isActive && (
              <motion.div
                layoutId="status-pill"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className="absolute inset-0 bg-red-500 rounded-full"
              />
            )}

            <Icon
              size={14}
              className={`relative z-10 ${
                isActive ? "text-white" : "text-white/60"
              }`}
            />
            <span className="relative z-10 whitespace-nowrap">{status}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StatusButtons;
