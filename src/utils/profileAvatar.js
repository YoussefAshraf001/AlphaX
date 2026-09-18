export const persistentAvatar = (value) => {
  if (typeof value !== "string") return null;
  const url = value.trim();
  return /^https?:\/\//i.test(url) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url) ? url : null;
};

export const avatarUpdates = (updates) => {
  if (!Object.prototype.hasOwnProperty.call(updates, "avatar")) return {};
  const avatar = updates.avatar === null ? null : persistentAvatar(updates.avatar);
  if (updates.avatar !== null && !avatar) throw new Error("Invalid profile image URL");
  return { avatar, ...(Object.prototype.hasOwnProperty.call(updates, "avatarMeta") || !avatar ? { avatarMeta: updates.avatarMeta || null } : {}) };
};
