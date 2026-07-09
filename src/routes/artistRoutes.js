const express = require("express");
const router = express.Router();
const {
  registerArtist,
  loginArtist,
  listPublicArtists,
  getPublicArtist,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  listPublicSchedule,
  listMySchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
} = require("../controllers/artistController");
const { authenticateArtist } = require("../middleware/auth");
const {
  uploadArtistProfileImages,
  uploadEventImage,
  handleUploadError,
} = require("../middleware/upload");
const { errorHandler } = require("../middleware/errorHandler");

// Public — fans / mobile app
router.get("/public", listPublicArtists);
router.get("/public/:id", getPublicArtist);
router.get("/public/:id/schedule", listPublicSchedule);

// Auth
router.post("/register", uploadArtistProfileImages, handleUploadError, registerArtist);
router.post("/login", loginArtist);

// Artist portal — schedule only, no ticketing
router.get("/me", authenticateArtist, getMyProfile);
router.put(
  "/me",
  authenticateArtist,
  uploadArtistProfileImages,
  handleUploadError,
  updateMyProfile
);
router.put("/me/change-password", authenticateArtist, changeMyPassword);
router.get("/me/schedule", authenticateArtist, listMySchedule);
router.post(
  "/me/schedule",
  authenticateArtist,
  uploadEventImage,
  handleUploadError,
  createScheduleItem
);
router.put(
  "/me/schedule/:scheduleId",
  authenticateArtist,
  uploadEventImage,
  handleUploadError,
  updateScheduleItem
);
router.delete(
  "/me/schedule/:scheduleId",
  authenticateArtist,
  deleteScheduleItem
);

router.use(errorHandler);

module.exports = router;
