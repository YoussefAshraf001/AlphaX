export const DEFAULT_PROFILE_ID = "main";

export const resolveProfileId = (selectedProfile) =>
  selectedProfile?.id || DEFAULT_PROFILE_ID;

export const profileDocPath = (email, profileId) => [
  "users",
  email,
  "profiles",
  profileId,
];

export const profileSavedCollectionPath = (email, profileId, mediaTypeDoc) => [
  "users",
  email,
  "profiles",
  profileId,
  "savedContent",
  mediaTypeDoc,
  "items",
];

export const profileSavedItemPath = (
  email,
  profileId,
  mediaTypeDoc,
  itemId,
) => [...profileSavedCollectionPath(email, profileId, mediaTypeDoc), String(itemId)];

export const legacySavedCollectionPath = (email, mediaTypeDoc) => [
  "users",
  email,
  "savedContent",
  mediaTypeDoc,
  "items",
];

export const profileLikedActorsCollectionPath = (email, profileId) => [
  "users",
  email,
  "profiles",
  profileId,
  "likedActors",
];

export const profileLikedActorItemPath = (email, profileId, actorId) => [
  ...profileLikedActorsCollectionPath(email, profileId),
  String(actorId),
];

export const legacyLikedActorsCollectionPath = (email) => [
  "users",
  email,
  "likedActors",
];

export const profileRatingsCollectionPath = (email, profileId, ratingTypeDoc) => [
  "users",
  email,
  "profiles",
  profileId,
  "ratings",
  ratingTypeDoc,
  "items",
];

export const profileRatingItemPath = (
  email,
  profileId,
  ratingTypeDoc,
  itemId,
) => [...profileRatingsCollectionPath(email, profileId, ratingTypeDoc), String(itemId)];

export const legacyRatingsCollectionPath = (email, ratingTypeDoc) => [
  "users",
  email,
  "ratings",
  ratingTypeDoc,
  "items",
];
