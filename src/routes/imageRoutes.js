const express = require("express");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const router = express.Router();
const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const cacheRoot = path.join(uploadsRoot, ".image-cache");
const allowedFolders = new Set([
  "events",
  "organizers",
  "profiles",
  "merchandise",
]);

const normalizedWidth = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 800;
  return Math.min(Math.max(parsed, 64), 1920);
};

router.get("/:folder/:filename", async (req, res, next) => {
  try {
    const { folder, filename } = req.params;
    if (!allowedFolders.has(folder) || path.basename(filename) !== filename) {
      return res.status(400).json({
        success: false,
        message: "Invalid image path",
      });
    }

    const sourcePath = path.join(uploadsRoot, folder, filename);
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    const width = normalizedWidth(req.query.w);
    const cacheDirectory = path.join(cacheRoot, folder);
    const cacheFilename = `${path.parse(filename).name}-${width}.webp`;
    const cachePath = path.join(cacheDirectory, cacheFilename);

    if (!fs.existsSync(cachePath)) {
      await fs.promises.mkdir(cacheDirectory, { recursive: true });
      await sharp(sourcePath, { failOn: "none" })
        .rotate()
        .resize({
          width,
          height: width,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 76, effort: 4 })
        .toFile(cachePath);
    }

    res.set({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/webp",
    });
    return res.sendFile(cachePath);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
