import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
import { uploadImageToCloudinary } from "../utils/cloudinaryUpload";
import { FiCamera, FiSave, FiLock, FiUsers } from "react-icons/fi";

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
    selectedProfile?.avatar || NotFoundPlaceholder,
  );

  const [imageSrc, setImageSrc] = useState(null);
  const [pendingGifSrc, setPendingGifSrc] = useState(null);
  const [pendingGifFile, setPendingGifFile] = useState(null);
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
      if (data.avatar) {
        setAvatarPreview(data.avatar);
      } else if (selectedProfile?.avatar) {
        setAvatarPreview(selectedProfile.avatar);
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
        setPendingGifFile(file);
        setImageSrc(null);
        setShowCrop(false);
        setAvatarPreview(nextSrc);
        toast("GIF selected. Click Save GIF to apply.", { icon: "i" });
        return;
      }

      setPendingGifSrc(null);
      setPendingGifFile(null);
      setImageSrc(nextSrc);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCrop(true);
    };
    reader.readAsDataURL(file);
  };

  const persistAvatar = async (source) => {
    const uploaded = await uploadImageToCloudinary(source, {
      folder: "alphax/avatars",
      tags: ["alphax", "avatar"],
    });
    if (!uploaded?.url) {
      throw new Error("Avatar upload failed");
    }
    const profileRef = doc(db, ...profileDocPath(user.email, activeProfileId));
    await setDoc(
      profileRef,
      {
        avatar: uploaded.url,
        avatarMeta: {
          storage: "cloudinary",
          publicId: uploaded.publicId || null,
          version: uploaded.version || null,
          width: uploaded.width || null,
          height: uploaded.height || null,
          format: uploaded.format || null,
        },
        avatarBase64: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setAvatarPreview(uploaded.url);
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
      const croppedDataUrl = await getCroppedCompressedImage(
        imageSrc,
        croppedPixels,
      );
      await persistAvatar(croppedDataUrl);
      setShowCrop(false);
      setImageSrc(null);
      setPendingGifFile(null);
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
    if (!pendingGifSrc || !pendingGifFile) {
      toast.error("Please select a GIF first");
      return;
    }
    try {
      setSavingAvatar(true);
      await persistAvatar(pendingGifFile);
      setPendingGifSrc(null);
      setPendingGifFile(null);
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
    <div className="relative min-h-screen bg-[#101012] text-white tracking-normal [&_button]:!rounded-md [&_button]:inline-flex [&_button]:items-center [&_button]:justify-center [&_button]:gap-2 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-rose-400 [&_button:focus-visible]:outline-offset-4 [&_input:focus-visible]:outline-rose-400">
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

          <header className="pt-7 pb-9 border-b border-white/10 [&>span]:text-rose-400 [&>span]:text-[11px] [&>span]:font-semibold [&>h1]:text-[28px] sm:[&>h1]:text-4xl [&>h1]:font-bold [&>h1]:my-3 [&>h1]:break-words [&>p]:text-sm [&>p]:text-zinc-400 [&>p]:break-words"><span>YOUR ACCOUNT</span><h1>Account Settings</h1><p>{user?.email}</p></header>
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-[240px_minmax(0,1fr)] gap-10 sm:gap-[72px] py-7 sm:py-10">
              <aside className="text-center max-sm:max-w-[280px] max-sm:w-full max-sm:justify-self-center">
                <div className="w-full">
                  <div className="relative">
                    <img
                      src={avatarPreview || NotFoundPlaceholder}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = NotFoundPlaceholder;
                      }}
                      alt="Profile"
                      className="w-32 h-32 object-cover rounded-full mx-auto mb-6 border-[3px] border-white/10"
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
                    className="mt-4 w-full rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 font-semibold transition inline-flex items-center justify-center gap-2"
                  >
                    <FiCamera aria-hidden="true" />
                    {savingAvatar && (
                      <span className="loading loading-spinner loading-xs text-white" />
                    )}
                    {pendingGifSrc
                      ? savingAvatar
                        ? "Saving GIF..."
                        : "Save GIF"
                      : "Upload New Avatar"}
                  </button>
                  <h2 className="text-xl font-semibold mt-6 break-words">{selectedProfile?.displayName || selectedProfile?.name || "Main"}</h2>
                  <span className="text-xs text-zinc-400">Active profile</span>
                  <button type="button" className="mt-7 px-4 py-3 border border-white/20 text-[13px] w-full hover:bg-white/5" onClick={() => navigate("/profiles")}><FiUsers /> Manage profiles</button>
                </div>
              </aside>

              <div className="min-w-0">
                <section className="pb-8 mb-8 border-b border-white/10 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-6 [&>label]:block [&>label]:text-zinc-400 [&>label]:text-[13px] [&>label]:mb-2.5 [&>input]:!rounded-md [&>input]:!bg-[#19191d] [&>input]:min-h-[46px]">
                  <h2>Profile</h2>
                  <label htmlFor="profile-display-name">Display name</label>
                  <input
                    id="profile-display-name"
                    maxLength={24}
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
                      <FiSave aria-hidden="true" />
                      {savingName ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                </section>

                <section className="pb-8 mb-8 border-b border-white/10 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-6 [&>label]:block [&>label]:text-zinc-400 [&>label]:text-[13px] [&>label]:mb-2.5 [&>input]:!rounded-md [&>input]:!bg-[#19191d] [&>input]:min-h-[46px]">
                  <h2>Security</h2>
                  <label>Email address</label>
                  <p className="text-zinc-400 text-sm break-words mb-6">{user?.email}</p>
                  <button
                    onClick={resetPassword}
                    disabled={sendingReset}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm font-semibold"
                  >
                    <FiLock aria-hidden="true" />
                    {sendingReset ? "Sending..." : "Reset Password"}
                  </button>
                </section>
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
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold inline-flex items-center gap-2"
                >
                  {savingAvatar && (
                    <span className="loading loading-spinner loading-xs text-white" />
                  )}
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
