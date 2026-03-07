import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { FaLock } from "react-icons/fa";

import { UserAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import NotFoundPlaceholder from "../assets/notFound-Placeholder.jpg";

const colorFromId = (id = "") => {
  const palette = ["#1f7aff", "#e50914", "#2ca17a", "#9b59b6", "#f39c12"];
  const hash = String(id)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

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

  return canvas.toDataURL("image/jpeg", 0.85);
};

const WhoIsWatching = () => {
  const { user } = UserAuth();
  const {
    profiles,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    verifyProfilePin,
    selectedProfile,
  } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  const requestedPath = location.state?.from;
  const returnPath =
    requestedPath &&
    requestedPath !== "/profiles" &&
    requestedPath !== "/login" &&
    requestedPath !== "/signup"
      ? requestedPath
      : "/";
  const [manageMode, setManageMode] = useState(false);
  const [editorMode, setEditorMode] = useState("edit");
  const [editingProfile, setEditingProfile] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editLock, setEditLock] = useState(false);
  const [editPin, setEditPin] = useState("");
  const [pinTarget, setPinTarget] = useState(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pendingProfileSelection, setPendingProfileSelection] = useState(null);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState(null);
  const pinInputRefs = useRef([]);
  const fileInputRef = useRef(null);
  const canDeleteProfile = profiles.length > 1;

  const manageButtonLabel = useMemo(
    () => (manageMode ? "Done" : "Manage Profiles"),
    [manageMode],
  );

  const openProfile = (profile) => {
    if (manageMode) {
      setEditorMode("edit");
      setEditingProfile(profile);
      setEditName(profile.name || "");
      setEditAvatar(profile.avatarBase64 || profile.avatar || "");
      setEditLock(Boolean(profile.locked));
      setEditPin(String(profile.pinCode || ""));
      return;
    }

    if (profile.locked) {
      setPinTarget(profile);
      setEnteredPin("");
      return;
    }

    const didSelect = selectProfile(profile);
    if (didSelect) {
      navigate(returnPath, { replace: true });
      return;
    }

    setPendingProfileSelection({
      profileId: profile.id,
      destination: returnPath,
    });
  };

  const closeEditor = () => {
    setEditorMode("edit");
    setEditingProfile(null);
    setEditName("");
    setEditAvatar("");
    setEditLock(false);
    setEditPin("");
    setRawImageSrc(null);
    setShowCrop(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedPixels(null);
  };

  const openCreateProfileModal = () => {
    setEditorMode("create");
    setEditingProfile(null);
    setEditName("");
    setEditAvatar("");
    setEditLock(false);
    setEditPin("");
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === "string" ? reader.result : "";
      if (!base64) return;
      if (file.type === "image/gif") {
        setEditAvatar(base64);
        toast("GIF applied without crop", { icon: "i" });
        return;
      }
      setRawImageSrc(base64);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setShowCrop(true);
    };
    reader.readAsDataURL(file);
  };

  const applyCroppedAvatar = async () => {
    if (!rawImageSrc || !croppedPixels) {
      toast.error("Select crop area first");
      return;
    }
    try {
      const croppedBase64 = await getCroppedCompressedImage(
        rawImageSrc,
        croppedPixels,
      );
      setEditAvatar(croppedBase64);
      setShowCrop(false);
      setRawImageSrc(null);
      toast.success("Preview updated");
    } catch {
      toast.error("Failed to crop image");
    }
  };

  const saveProfileEdits = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Profile name is required");
      return;
    }

    if (editLock && String(editPin || "").replace(/\D/g, "").length !== 4) {
      toast.error("Passcode must be exactly 4 digits");
      return;
    }

    if (editorMode === "create") {
      await addProfile({
        name: trimmed,
        avatarBase64: editAvatar || null,
        locked: editLock,
        pinCode: editPin,
      });
      closeEditor();
      toast.success("Profile added");
      return;
    }

    if (!editingProfile?.id) return;
    await updateProfile(editingProfile.id, {
      name: trimmed,
      avatarBase64: editAvatar || null,
      locked: editLock,
      pinCode: editPin,
    });
    closeEditor();
    toast.success("Profile updated");
  };

  const removeProfile = async () => {
    if (!editingProfile?.id) return;
    if (!canDeleteProfile) {
      toast.error("You must keep at least one profile");
      return;
    }

    const ok = window.confirm(`Delete profile "${editingProfile.name}"?`);
    if (!ok) return;

    const deleted = await deleteProfile(editingProfile.id);
    if (!deleted) {
      toast.error("Could not delete profile");
      return;
    }

    closeEditor();
    toast.success("Profile deleted");
  };

  const confirmPin = () => {
    if (!pinTarget) return;
    const valid = verifyProfilePin(pinTarget, enteredPin);
    if (!valid) {
      toast.error("Wrong passcode");
      setEnteredPin("");
      pinInputRefs.current[0]?.focus();
      return;
    }

    const didSelect = selectProfile(pinTarget);
    if (didSelect) {
      navigate(returnPath, { replace: true });
      return;
    }

    setPendingProfileSelection({
      profileId: pinTarget.id,
      destination: returnPath,
    });
  };

  const handlePinDigitChange = (index, rawValue) => {
    const digit = String(rawValue || "")
      .replace(/\D/g, "")
      .slice(-1);
    const current = enteredPin.padEnd(4, " ").split("");
    current[index] = digit || " ";
    const nextPin = current.join("").replace(/\s/g, "");
    setEnteredPin(nextPin);

    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinDigitKeyDown = (index, event) => {
    if (event.key !== "Backspace") return;
    event.preventDefault();

    const current = enteredPin.padEnd(4, " ").split("");
    if (current[index] && current[index] !== " ") {
      current[index] = " ";
      setEnteredPin(current.join("").replace(/\s/g, ""));
      return;
    }

    if (index > 0) {
      current[index - 1] = " ";
      setEnteredPin(current.join("").replace(/\s/g, ""));
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (!pinTarget) return;
    if (enteredPin.length !== 4) return;
    confirmPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredPin, pinTarget]);

  useEffect(() => {
    if (!pinTarget) return;
    const timer = setTimeout(() => {
      pinInputRefs.current[0]?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [pinTarget]);

  useEffect(() => {
    if (!pendingProfileSelection) return;
    const selectedId = selectedProfile?.id;
    if (!selectedId) return;
    if (selectedId !== pendingProfileSelection.profileId) return;
    navigate(pendingProfileSelection.destination, { replace: true });
    setPendingProfileSelection(null);
  }, [pendingProfileSelection, selectedProfile?.id, navigate]);

  return (
    <div className="relative min-h-screen text-white flex items-center justify-center px-6 overflow-hidden bg-[#131313]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(239,68,68,0.22),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.10),transparent_34%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-[#141414]/45 to-black/60" />
      </div>
      <div className="relative z-10 w-full max-w-5xl">
        <h1 className="text-center text-4xl md:text-5xl font-semibold mb-10">
          Who's watching?
        </h1>

        <div className="flex flex-wrap items-start justify-center gap-6 md:gap-8">
          {profiles.map((profile, idx) => (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              onClick={() => openProfile(profile)}
              className="group w-28 md:w-32"
            >
              <div
                className="relative w-28 h-28 md:w-32 md:h-32 rounded-2xl border-2 border-white/10 group-hover:border-white transition overflow-hidden mx-auto shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                style={{
                  backgroundColor: profile.avatar
                    ? "transparent"
                    : colorFromId(profile.id),
                }}
              >
                {profile.avatar ? (
                  <img
                    src={profile.avatar || NotFoundPlaceholder}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = NotFoundPlaceholder;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-semibold">
                    {String(profile.name || "P")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}

                {profile.locked && (
                  <span
                    className="
                      absolute inset-0 z-10
                      bg-black/65 backdrop-blur-[1px]
                      flex items-center justify-center
                      opacity-0 group-hover:opacity-100
                      transition-opacity duration-200
                    "
                  >
                    <span className="flex items-center gap-2 text-white text-xs font-semibold tracking-wide uppercase">
                      <FaLock size={15} />
                      Locked
                    </span>
                  </span>
                )}

                {manageMode && (
                  <span className="absolute inset-0 z-20 bg-black/35 border border-white/15 flex items-center justify-center text-xs font-semibold">
                    Edit
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-white/70 group-hover:text-white transition truncate">
                {profile.name}
              </p>
            </motion.button>
          ))}

          {!manageMode && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: profiles.length * 0.04 }}
              onClick={openCreateProfileModal}
              className="group w-28 md:w-32"
            >
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-sm border-2 border-white/20 group-hover:border-white transition flex items-center justify-center mx-auto text-5xl text-white/70 group-hover:text-white">
                +
              </div>
              <p className="mt-3 text-sm text-white/55 group-hover:text-white/85 transition">
                Add Profile
              </p>
            </motion.button>
          )}
        </div>

        <div className="mt-14 text-center">
          <button
            onClick={() => setManageMode((prev) => !prev)}
            className="px-8 py-2 border border-white/30 text-white/70 hover:text-white hover:border-white transition tracking-[0.2em] uppercase text-xs"
          >
            {manageButtonLabel}
          </button>
          {user?.email && (
            <p className="mt-4 text-xs text-white/45">{user.email}</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(editingProfile || editorMode === "create") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeEditor}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">
                {editorMode === "create" ? "Add Profile" : "Edit Profile"}
              </h3>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50 mb-2">
                    Preview
                  </p>
                  <div className="rounded-xl border border-white/15 bg-black/40 p-3">
                    <div className="w-full aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                      {editAvatar ? (
                        <img
                          src={editAvatar}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = NotFoundPlaceholder;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/45 text-sm">
                          No image
                        </div>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-sm py-2 transition"
                    >
                      Upload Image
                    </button>
                    <p className="mt-2 text-[11px] text-white/50">
                      JPG/PNG can be cropped. GIF is applied directly.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/60">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={24}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-red-500"
                  />

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      id="lockProfile"
                      type="checkbox"
                      checked={editLock}
                      onChange={(e) => setEditLock(e.target.checked)}
                    />
                    <label
                      htmlFor="lockProfile"
                      className="text-sm text-white/80"
                    >
                      Lock profile with passcode
                    </label>
                  </div>

                  {editLock && (
                    <>
                      <label className="mt-3 block text-xs text-white/60">
                        Passcode
                      </label>
                      <input
                        value={editPin}
                        onChange={(e) =>
                          setEditPin(
                            e.target.value.replace(/\D/g, "").slice(0, 4),
                          )
                        }
                        placeholder="4 digits"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-red-500"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-between gap-2">
                {editorMode === "edit" ? (
                  <button
                    onClick={removeProfile}
                    disabled={!canDeleteProfile}
                    className="px-4 py-2 rounded-lg text-sm bg-red-600/80 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={closeEditor}
                    className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfileEdits}
                    className="px-4 py-2 rounded-lg text-sm bg-white text-black hover:bg-white/90"
                  >
                    {editorMode === "create" ? "Create" : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCrop && rawImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setShowCrop(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold">Crop Image</h3>
                <p className="text-sm text-white/55 mt-1">
                  Adjust position and zoom, then apply.
                </p>
              </div>
              <div className="relative h-[340px] bg-black">
                <Cropper
                  image={rawImageSrc}
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
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyCroppedAvatar}
                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-sm font-semibold text-white"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pinTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPinTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Enter Passcode</h3>
              <p className="mt-1 text-sm text-white/60">
                {pinTarget.name} is locked.
              </p>

              <div className="mt-4 flex items-center justify-center gap-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <input
                    key={`pin-digit-${idx}`}
                    ref={(el) => {
                      pinInputRefs.current[idx] = el;
                    }}
                    value={enteredPin[idx] || ""}
                    onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinDigitKeyDown(idx, e)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    className="w-12 h-12 text-center text-xl rounded-lg border border-white/20 bg-white/5 outline-none focus:border-red-500"
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-white/45">
                Enter 4-digit passcode
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setPinTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhoIsWatching;
