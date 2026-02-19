import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserAuth } from "./AuthContext";

const ProfileContext = createContext(null);

const getSelectedKey = (email) => `alphax.selectedProfile.${email}`;

const defaultProfileFromUser = (user) => ({
  id: "main",
  name: user?.displayName || "Main",
  username: user?.displayName || "main",
  displayName: user?.displayName || "Main",
  avatar: user?.photoURL || null,
  avatarBase64: user?.photoURL || null,
  locked: false,
  pinCode: null,
});

export const ProfileContextProvider = ({ children }) => {
  const { user, loading } = UserAuth();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user?.email) {
      setProfiles([]);
      setSelectedProfile(null);
      setProfileLoading(false);
      return;
    }

    const selectedKey = getSelectedKey(user.email);
    const profilesRef = collection(db, "users", user.email, "profiles");

    setProfileLoading(true);

    const unsub = onSnapshot(
      profilesRef,
      async (snap) => {
        if (snap.empty) {
          const fallback = defaultProfileFromUser(user);
          await setDoc(
            doc(db, "users", user.email, "profiles", fallback.id),
            {
              id: fallback.id,
              name: fallback.name,
              username: fallback.username,
              displayName: fallback.displayName,
              avatar: fallback.avatar,
              avatarBase64: fallback.avatarBase64,
              locked: false,
              pinCode: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          return;
        }

        const nextProfiles = snap.docs
          .map((d) => {
            const data = d.data() || {};
            return {
              id: String(data.id || d.id),
              name: data.name || data.displayName || "Profile",
              username: data.username || data.name || "profile",
              displayName: data.displayName || data.name || "Profile",
              avatar: data.avatar || data.avatarBase64 || null,
              avatarBase64: data.avatarBase64 || data.avatar || null,
              locked: Boolean(data.locked),
              pinCode: data.pinCode || null,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          })
          .sort((a, b) => {
            const aTs = Number(a?.createdAt?.seconds || 0);
            const bTs = Number(b?.createdAt?.seconds || 0);
            return aTs - bTs;
          });

        setProfiles(nextProfiles);

        const selectedId = localStorage.getItem(selectedKey);
        const selected = nextProfiles.find((p) => p.id === selectedId) || null;
        setSelectedProfile(selected);
        setProfileLoading(false);
      },
      () => {
        setProfiles([]);
        setSelectedProfile(null);
        setProfileLoading(false);
      },
    );

    return () => unsub();
  }, [user, loading]);

  const selectProfile = useCallback((profile) => {
    const email = user?.email || auth.currentUser?.email;
    if (!email || !profile) return false;
    localStorage.setItem(getSelectedKey(email), profile.id);
    setSelectedProfile(profile);
    return true;
  }, [user?.email]);

  const clearSelectedProfile = useCallback(() => {
    const email = user?.email || auth.currentUser?.email;
    if (!email) return;
    localStorage.removeItem(getSelectedKey(email));
    setSelectedProfile(null);
  }, [user?.email]);

  const addProfile = useCallback(async (profileInput) => {
    if (!user?.email) return;
    const name =
      typeof profileInput === "string"
        ? profileInput
        : profileInput?.name || "";
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const avatarValue =
      typeof profileInput === "object" &&
      typeof profileInput?.avatarBase64 === "string"
        ? profileInput.avatarBase64
        : null;
    const pin =
      typeof profileInput === "object" &&
      typeof profileInput?.pinCode === "string"
        ? profileInput.pinCode.replace(/\D/g, "").slice(0, 4)
        : null;
    const locked = Boolean(
      typeof profileInput === "object" &&
        profileInput?.locked &&
        pin?.length === 4,
    );

    const profileId = `p_${Date.now()}`;
    await setDoc(
      doc(db, "users", user.email, "profiles", profileId),
      {
        id: profileId,
        name: trimmed.slice(0, 24),
        username: trimmed.slice(0, 24),
        displayName: trimmed.slice(0, 24),
        avatar: avatarValue,
        avatarBase64: avatarValue,
        locked,
        pinCode: locked ? pin : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return profileId;
  }, [user?.email]);

  const updateProfile = useCallback(
    async (profileId, updates = {}) => {
      if (!user?.email || !profileId) return false;
      const rawName = String(updates.name || "").trim();
      const cleanName = rawName.slice(0, 24);
      const avatarValue =
        typeof updates.avatarBase64 === "string" ? updates.avatarBase64 : null;
      const pinCode =
        typeof updates.pinCode === "string" && updates.pinCode.trim()
          ? updates.pinCode.replace(/\D/g, "").slice(0, 4)
          : null;
      const locked = Boolean(updates.locked && pinCode?.length === 4);

      await setDoc(
        doc(db, "users", user.email, "profiles", String(profileId)),
        {
          ...(cleanName
            ? {
                name: cleanName,
                username: cleanName,
                displayName: cleanName,
              }
            : {}),
          avatar: avatarValue,
          avatarBase64: avatarValue,
          locked,
          pinCode: locked ? pinCode : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    },
    [user?.email],
  );

  const deleteProfile = useCallback(
    async (profileId) => {
      if (!user?.email || !profileId) return false;
      if (profiles.length <= 1) return false;

      await deleteDoc(doc(db, "users", user.email, "profiles", String(profileId)));

      if (selectedProfile?.id === String(profileId)) {
        localStorage.removeItem(getSelectedKey(user.email));
        setSelectedProfile(null);
      }
      return true;
    },
    [user?.email, profiles.length, selectedProfile?.id],
  );

  const verifyProfilePin = useCallback((profile, enteredPin) => {
    if (!profile?.locked) return true;
    return String(profile.pinCode || "") === String(enteredPin || "");
  }, []);

  const value = useMemo(
    () => ({
      profiles,
      selectedProfile,
      selectProfile,
      clearSelectedProfile,
      addProfile,
      updateProfile,
      deleteProfile,
      verifyProfilePin,
      profileLoading,
    }),
    [
      profiles,
      selectedProfile,
      selectProfile,
      clearSelectedProfile,
      addProfile,
      updateProfile,
      deleteProfile,
      verifyProfilePin,
      profileLoading,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used inside <ProfileContextProvider>");
  }
  return ctx;
};
