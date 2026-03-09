const CLOUDINARY_CLOUD_NAME = String(
  process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "",
).trim();
const CLOUDINARY_UPLOAD_PRESET = String(
  process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "",
).trim();
const CLOUDINARY_FOLDER = String(
  process.env.REACT_APP_CLOUDINARY_FOLDER || "alphax",
).trim();

const isDataUrl = (value) => String(value || "").startsWith("data:");

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Failed to read image data");
  }
  return response.blob();
};

export const isCloudinaryConfigured = () =>
  Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

export const isCloudinaryUrl = (value) =>
  /^https?:\/\/res\.cloudinary\.com\/.+/i.test(String(value || "").trim());

export const uploadImageToCloudinary = async (source, options = {}) => {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary not configured. Set REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const folder = String(options.folder || CLOUDINARY_FOLDER).trim();
  const tags = Array.isArray(options.tags) ? options.tags.filter(Boolean) : [];
  const publicId = String(options.publicId || "").trim();
  const filenameOverride = String(options.filenameOverride || "").trim();

  const formData = new FormData();
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);
  if (tags.length) formData.append("tags", tags.join(","));
  if (publicId) formData.append("public_id", publicId);
  if (filenameOverride) formData.append("filename_override", filenameOverride);

  if (source instanceof File || source instanceof Blob) {
    formData.append("file", source);
  } else if (isDataUrl(source)) {
    const blob = await dataUrlToBlob(source);
    const inferredName = filenameOverride || publicId || "upload";
    formData.append("file", blob, `${inferredName}.webp`);
  } else {
    formData.append("file", String(source || "").trim());
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ error: { message: "Upload failed" } }));
    throw new Error(payload?.error?.message || "Upload failed");
  }

  const payload = await response.json();
  const secureUrl = String(payload.secure_url || "").trim();
  const fallbackUrl = String(payload.url || "")
    .trim()
    .replace(/^http:\/\//i, "https://");
  return {
    url: secureUrl || fallbackUrl || null,
    publicId: payload.public_id || null,
    version: payload.version || null,
    bytes: payload.bytes || null,
    format: payload.format || null,
    width: payload.width || null,
    height: payload.height || null,
  };
};
