const MAX_PROFILE_IMAGES = 10;

const parseProfileImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
};

const resolveProfileImages = (userLike) => {
  const images = parseProfileImages(userLike?.profile_images);
  if (images.length) return images.slice(0, MAX_PROFILE_IMAGES);
  const single = String(userLike?.profile_image || "").trim();
  return single ? [single] : [];
};

const syncProfileImages = (images) => {
  const unique = [];
  for (const image of parseProfileImages(images)) {
    if (!unique.includes(image)) unique.push(image);
    if (unique.length >= MAX_PROFILE_IMAGES) break;
  }
  return {
    profile_images: unique,
    profile_image: unique[0] || null,
  };
};

const parseRemoveProfileImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [];
};

const collectUploadedProfilePaths = (req) => {
  const paths = [];
  const fromArray = req.files?.profile_images || [];
  for (const file of fromArray) {
    if (file?.path) paths.push(file.path);
  }
  const fromSingle = req.files?.profile_image?.[0] || req.file;
  if (fromSingle?.path) paths.push(fromSingle.path);
  return paths;
};

const withResolvedProfileImages = (userLike) => {
  const images = resolveProfileImages(userLike);
  return {
    ...(userLike?.toJSON ? userLike.toJSON() : { ...userLike }),
    profile_images: images,
    profile_image: images[0] || null,
  };
};

module.exports = {
  MAX_PROFILE_IMAGES,
  parseProfileImages,
  resolveProfileImages,
  syncProfileImages,
  parseRemoveProfileImages,
  collectUploadedProfilePaths,
  withResolvedProfileImages,
};
