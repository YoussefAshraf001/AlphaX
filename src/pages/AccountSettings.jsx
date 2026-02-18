import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { IoMdArrowBack } from "react-icons/io";
import { useNavigate } from "react-router-dom";

import { auth, db } from "../firebase";
import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";
import {
  profileDocPath,
  resolveProfileId,
} from "../utils/profileFirestorePaths";

const createImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const getCroppedCompressedImage = async (src, cropAreaPixels) => {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const SIZE = 320;
  canvas.width = SIZE;
  canvas.height = SIZE;

  ctx.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    SIZE,
    SIZE,
  );

  return canvas.toDataURL("image/jpeg", 0.8);
};

const AccountSettings = () => {
  const { user } = UserAuth();
  const { selectedProfile } = useProfile();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const activeProfileId = resolveProfileId(selectedProfile);

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarPreview, setAvatarPreview] = useState(
    selectedProfile?.avatar || selectedProfile?.avatarBase64 || NotFoundPlaceholder,
  );

  const [imageSrc, setImageSrc] = useState(null);
  const [pendingGifSrc, setPendingGifSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const [showCrop, setShowCrop] = useState(false);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  useEffect(() => {
    setDisplayName(selectedProfile?.displayName || selectedProfile?.name || "");
  }, [selectedProfile?.displayName, selectedProfile?.name]);

  useEffect(() => {
    if (!user?.email) return;
    const profileRef = doc(db, ...profileDocPath(user.email, activeProfileId));
    const unsub = onSnapshot(profileRef, (snap) => {
      const data = snap.data() || {};
      if (data.avatar || data.avatarBase64) {
        setAvatarPreview(data.avatar || data.avatarBase64);
      } else if (selectedProfile?.avatar || selectedProfile?.avatarBase64) {
        setAvatarPreview(selectedProfile.avatar || selectedProfile.avatarBase64);
      } else {
        setAvatarPreview(NotFoundPlaceholder);
      }
      if (typeof data.displayName === "string" && data.displayName.trim()) {
        setDisplayName(data.displayName);
      } else if (typeof data.name === "string" && data.name.trim()) {
        setDisplayName(data.name);
      }
    });
    return () => unsub();
  }, [user?.email, activeProfileId, selectedProfile]);

  useEffect(() => {
    if (!showCrop) return;
    const onEsc = (e) => {
      if (e.key === "Escape") setShowCrop(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [showCrop]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextSrc = reader.result;
      if (file.type === "image/gif") {
        setPendingGifSrc(nextSrc);
        setImageSrc(null);
        setShowCrop(false);
        setAvatarPreview(nextSrc);
        toast("GIF selected. Click Save GIF to apply.", { icon: "i" });
        return;
      }

      setPendingGifSrc(null);
      setImageSrc(nextSrc);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCrop(true);
    };
    reader.readAsDataURL(file);
  };

  const persistAvatar = async (base64) => {
    const profileRef = doc(db, ...profileDocPath(user.email, activeProfileId));
    await setDoc(
      profileRef,
      {
        avatar: base64,
        avatarBase64: base64,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setAvatarPreview(base64);
  };

  const saveAvatar = async () => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!croppedPixels || !imageSrc) {
      toast.error("Please crop image first");
      return;
    }

    try {
      setSavingAvatar(true);
      const base64 = await getCroppedCompressedImage(imageSrc, croppedPixels);
      await persistAvatar(base64);
      setShowCrop(false);
      setImageSrc(null);
      toast.success("Profile image updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save image");
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveGifAvatar = async () => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    if (!pendingGifSrc) {
      toast.error("Please select a GIF first");
      return;
    }
    try {
      setSavingAvatar(true);
      await persistAvatar(pendingGifSrc);
      setPendingGifSrc(null);
      toast.success("GIF avatar updated");
    } catch {
      toast.error("Failed to save GIF avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveName = async () => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    const nextName = displayName.trim();
    if (!nextName) {
      toast.error("Display name cannot be empty");
      return;
    }

    try {
      setSavingName(true);
      await setDoc(
        doc(db, ...profileDocPath(user.email, activeProfileId)),
        {
          name: nextName,
          username: nextName,
          displayName: nextName,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      toast.success("Display name updated");
    } catch {
      toast.error("Failed to update display name");
    } finally {
      setSavingName(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) {
      toast.error("Login required");
      return;
    }
    try {
      setSendingReset(true);
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="relative min-h-screen text-white bg-[#090909] overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/75 to-[#090909]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(239,68,68,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.08),transparent_35%)]" />
      </div>

      <div className="relative z-10 px-4 md:px-8 pt-24 pb-10">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              if (canGoBack) navigate(-1);
            }}
            disabled={!canGoBack}
            className="mb-4 flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/10 hover:bg-white/20 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white/10"
          >
            <IoMdArrowBack size={18} />
            Back
          </button>

          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-5 md:p-8 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-4">
                <div className="w-full max-w-[320px] mx-auto">
                  <div className="relative">
                    <img
                      src={avatarPreview || NotFoundPlaceholder}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = NotFoundPlaceholder;
                      }}
                      alt="Profile"
                      className="w-full h-[340px] object-cover rounded-2xl border border-white/15 shadow-2xl"
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                    className="hidden"
                  />

                  <button
                    onClick={() => {
                      if (pendingGifSrc) {
                        saveGifAvatar();
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    disabled={savingAvatar}
                    className="mt-4 w-full rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 font-semibold transition"
                  >
                    {pendingGifSrc
                      ? savingAvatar
                        ? "Saving GIF..."
                        : "Save GIF"
                      : "Upload New Avatar"}
                  </button>
                  <p className="text-xs text-white/50 mt-2 text-center">
                    Upload, crop, and save to your profile. GIFs are supported.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col gap-5">
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                    Account Settings
                  </h1>
                  <p className="text-white/60 mt-1">{user?.email}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                  <p className="text-xs uppercase tracking-wider text-white/45 mb-2">
                    Display Name
                  </p>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-white placeholder-white/35 focus:outline-none focus:border-white/25"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={saveName}
                      disabled={savingName}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-semibold"
                    >
                      {savingName ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
                  <p className="text-xs uppercase tracking-wider text-white/45 mb-2">
                    Security
                  </p>
                  <p className="text-sm text-white/70 mb-3">
                    Send a password reset email to your account.
                  </p>
                  <button
                    onClick={resetPassword}
                    disabled={sendingReset}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-semibold"
                  >
                    {sendingReset ? "Sending..." : "Reset Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCrop && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setShowCrop(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111]/95 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Crop Profile Image</h3>
              <p className="text-sm text-white/55 mt-1">
                Position your image and adjust zoom.
              </p>
            </div>

            <div className="relative h-[340px] bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedPixels(pixels)}
              />
            </div>

            <div className="px-5 py-4 border-t border-white/10">
              <label className="text-xs uppercase tracking-wider text-white/45">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full mt-2"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowCrop(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAvatar}
                  disabled={savingAvatar}
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold"
                >
                  {savingAvatar ? "Saving..." : "Save Avatar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
