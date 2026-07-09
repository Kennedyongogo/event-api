const { User, ArtistSchedule, sequelize } = require("../models");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const config = require("../config/config");
const { convertToRelativePath } = require("../utils/filePath");
const {
  resolveProfileImages,
  syncProfileImages,
  parseRemoveProfileImages,
  collectUploadedProfilePaths,
  withResolvedProfileImages,
} = require("../utils/profileImages");
const {
  normalizeArtistGenres,
  parseGenreFromBody,
  withPortalArtistGenres,
  withPublicArtistGenres,
} = require("../utils/artistGenres");
const { sanitizeUser, signToken } = require("./userController");
const { WRONG_ACCOUNT_TYPE, organizerPortalWrongTabMessage } = require("../utils/authMessages");

const parseBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const buildScheduleWhere = ({
  artistId,
  status = "all",
  date_from,
  date_to,
  publicOnly = false,
}) => {
  const conditions = [];

  if (artistId) conditions.push({ artist_id: artistId });
  if (publicOnly) conditions.push({ is_public: true });

  const today = startOfToday();
  if (status === "upcoming") {
    conditions.push({ activity_date: { [Op.gte]: today } });
  } else if (status === "past") {
    conditions.push({ activity_date: { [Op.lt]: today } });
  }

  if (date_from) {
    conditions.push({ activity_date: { [Op.gte]: startOfDay(date_from) } });
  }
  if (date_to) {
    conditions.push({ activity_date: { [Op.lte]: endOfDay(date_to) } });
  }

  return conditions.length ? { [Op.and]: conditions } : {};
};

const artistPublicAttributes = [
  "id",
  "full_name",
  "stage_name",
  "bio",
  "genre",
  "profile_image",
  "profile_images",
  "facebook_url",
  "instagram_url",
  "tiktok_url",
  "twitter_url",
  "linkedin_url",
];

const normalizeSocialUrl = (value) => {
  if (value === undefined) return undefined;
  const trimmed = String(value || "").trim();
  return trimmed || null;
};

const formatArtistPortalResponse = (artist) =>
  withPortalArtistGenres(withResolvedProfileImages(sanitizeUser(artist)));

const formatPublicArtistResponse = (artist) =>
  withPublicArtistGenres(withResolvedProfileImages(sanitizeUser(artist)));

const applyProfileImageUpdates = (artist, req) => {
  const removeAll =
    req.body.remove_profile_image === true ||
    req.body.remove_profile_image === "true";

  let images = resolveProfileImages(artist);
  if (removeAll) {
    images = [];
  } else {
    const toRemove = parseRemoveProfileImages(req.body.remove_profile_images);
    if (toRemove.length) {
      images = images.filter((image) => !toRemove.includes(image));
    }
  }

  const uploadedPaths = collectUploadedProfilePaths(req).map((filePath) =>
    convertToRelativePath(filePath)
  );
  images = [...images, ...uploadedPaths.filter(Boolean)];

  return syncProfileImages(images);
};

const registerArtist = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      phone,
      stage_name,
      bio,
      genre,
      facebook_url,
      instagram_url,
      tiktok_url,
      twitter_url,
      linkedin_url,
    } = req.body;

    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();
    if (!normalizedEmail || !password || !(full_name || stage_name)) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const existing = await User.findOne({
      where: { email: normalizedEmail, role: "artist" },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Artist account with this email already exists",
      });
    }

    const uploadedPaths = collectUploadedProfilePaths(req).map((filePath) =>
      convertToRelativePath(filePath)
    );
    const syncedImages = syncProfileImages(uploadedPaths.filter(Boolean));
    const hashedPassword = await bcrypt.hash(password, 10);

    const artist = await User.create({
      role: "artist",
      full_name: full_name || stage_name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      stage_name: stage_name || full_name,
      bio,
      genre: normalizeArtistGenres(genre),
      profile_image: syncedImages.profile_image,
      profile_images: syncedImages.profile_images,
      facebook_url: normalizeSocialUrl(facebook_url),
      instagram_url: normalizeSocialUrl(instagram_url),
      tiktok_url: normalizeSocialUrl(tiktok_url),
      twitter_url: normalizeSocialUrl(twitter_url),
      linkedin_url: normalizeSocialUrl(linkedin_url),
    });

    const token = signToken(artist);

    res.status(201).json({
      success: true,
      message: "Artist account created. Add your schedule anytime.",
      data: {
        artist: formatArtistPortalResponse(artist),
        token,
      },
    });
  } catch (error) {
    console.error("Error registering artist:", error);
    res.status(500).json({
      success: false,
      message: "Error registering artist",
      error: error.message,
    });
  }
};

const loginArtist = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();

    const artist = await User.findOne({
      where: { email: normalizedEmail, role: "artist" },
    });

    if (!artist) {
      const matches = await User.findAll({
        where: { email: normalizedEmail },
      });
      const message = organizerPortalWrongTabMessage(matches, "artist");
      if (message) {
        return res.status(403).json({
          success: false,
          code: WRONG_ACCOUNT_TYPE,
          message,
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!artist.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const valid = await bcrypt.compare(password, artist.password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    await artist.update({ lastLogin: new Date() });
    const token = signToken(artist);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        artist: formatArtistPortalResponse(artist),
        token,
      },
    });
  } catch (error) {
    console.error("Artist login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

const listPublicArtists = async (req, res) => {
  try {
    const { page, limit, genre, search } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const where = { role: "artist", isActive: true };
    if (genre) {
      where[Op.and] = [
        ...(where[Op.and] ? [where[Op.and]] : []),
        { genre: { [Op.contains]: [genre] } },
      ];
    }
    if (search) {
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { stage_name: { [Op.iLike]: `%${search}%` } },
        sequelize.where(sequelize.cast(sequelize.col("genre"), "text"), {
          [Op.iLike]: `%${search}%`,
        }),
      ];
    }

    const totalCount = await User.count({ where });
    const artists = await User.findAll({
      where,
      attributes: artistPublicAttributes,
      limit: limitNum,
      offset,
      order: [["stage_name", "ASC"]],
    });

    const artistIds = artists.map((artist) => artist.id);
    let upcomingCounts = new Map();
    let totalCounts = new Map();

    if (artistIds.length) {
      const today = startOfToday();
      const [upcomingRows, totalRows] = await Promise.all([
        ArtistSchedule.findAll({
          attributes: [
            "artist_id",
            [ArtistSchedule.sequelize.fn("COUNT", ArtistSchedule.sequelize.col("id")), "count"],
          ],
          where: {
            artist_id: artistIds,
            is_public: true,
            activity_date: { [Op.gte]: today },
          },
          group: ["artist_id"],
          raw: true,
        }),
        ArtistSchedule.findAll({
          attributes: [
            "artist_id",
            [ArtistSchedule.sequelize.fn("COUNT", ArtistSchedule.sequelize.col("id")), "count"],
          ],
          where: {
            artist_id: artistIds,
            is_public: true,
          },
          group: ["artist_id"],
          raw: true,
        }),
      ]);

      upcomingCounts = new Map(
        upcomingRows.map((row) => [
          String(row.artist_id),
          Number(row.count) || 0,
        ])
      );
      totalCounts = new Map(
        totalRows.map((row) => [String(row.artist_id), Number(row.count) || 0])
      );
    }

    const artistsWithCounts = artists.map((artist) => ({
      ...formatPublicArtistResponse(artist),
      upcomingShows: upcomingCounts.get(String(artist.id)) || 0,
      totalShows: totalCounts.get(String(artist.id)) || 0,
    }));

    res.status(200).json({
      success: true,
      data: artistsWithCounts,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching artists",
      error: error.message,
    });
  }
};

const getPublicArtist = async (req, res) => {
  try {
    const artist = await User.findOne({
      where: { id: req.params.id, role: "artist", isActive: true },
      attributes: artistPublicAttributes,
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    res.status(200).json({ success: true, data: formatPublicArtistResponse(artist) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching artist",
      error: error.message,
    });
  }
};

const getMyProfile = async (req, res) => {
  res.status(200).json({
    success: true,
    data: formatArtistPortalResponse(req.user),
  });
};

const updateMyProfile = async (req, res) => {
  try {
    const artist = req.user;
    const {
      full_name,
      phone,
      stage_name,
      bio,
      genre,
      facebook_url,
      instagram_url,
      tiktok_url,
      twitter_url,
      linkedin_url,
    } = req.body;

    const syncedImages = applyProfileImageUpdates(artist, req);

    await artist.update({
      full_name: full_name ?? artist.full_name,
      phone: phone ?? artist.phone,
      stage_name: stage_name ?? artist.stage_name,
      bio: bio ?? artist.bio,
      ...(genre !== undefined ? { genre: parseGenreFromBody(genre) } : {}),
      profile_image: syncedImages.profile_image,
      profile_images: syncedImages.profile_images,
      ...(facebook_url !== undefined
        ? { facebook_url: normalizeSocialUrl(facebook_url) }
        : {}),
      ...(instagram_url !== undefined
        ? { instagram_url: normalizeSocialUrl(instagram_url) }
        : {}),
      ...(tiktok_url !== undefined
        ? { tiktok_url: normalizeSocialUrl(tiktok_url) }
        : {}),
      ...(twitter_url !== undefined
        ? { twitter_url: normalizeSocialUrl(twitter_url) }
        : {}),
      ...(linkedin_url !== undefined
        ? { linkedin_url: normalizeSocialUrl(linkedin_url) }
        : {}),
    });

    res.status(200).json({
      success: true,
      message: "Profile updated",
      data: formatArtistPortalResponse(artist),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const artist = await User.findByPk(req.userId);

    const valid = await bcrypt.compare(currentPassword, artist.password);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    await artist.update({
      password: await bcrypt.hash(newPassword, 10),
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating password",
      error: error.message,
    });
  }
};

const listPublicSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, status, date_from, date_to } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const artist = await User.findOne({
      where: { id, role: "artist", isActive: true },
      attributes: ["id"],
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const where = buildScheduleWhere({
      artistId: id,
      status: status || "upcoming",
      date_from,
      date_to,
      publicOnly: true,
    });

    const orderDir = (status || "upcoming") === "past" ? "DESC" : "ASC";
    const [items, totalCount] = await Promise.all([
      ArtistSchedule.findAll({
        where,
        order: [["activity_date", orderDir]],
        limit: limitNum,
        offset,
      }),
      ArtistSchedule.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum) || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching schedule",
      error: error.message,
    });
  }
};

const listMySchedule = async (req, res) => {
  try {
    const { page, limit, status, date_from, date_to } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;
    const tabStatus = status || "all";

    const where = buildScheduleWhere({
      artistId: req.userId,
      status: tabStatus,
      date_from,
      date_to,
    });

    const today = startOfToday();
    const artistBase = { artist_id: req.userId };
    const orderDir = tabStatus === "past" ? "DESC" : "ASC";

    const [items, totalCount, upcomingCount, pastCount, totalAll, publicCount] =
      await Promise.all([
        ArtistSchedule.findAll({
          where,
          order: [["activity_date", orderDir]],
          limit: limitNum,
          offset,
        }),
        ArtistSchedule.count({ where }),
        ArtistSchedule.count({
          where: { ...artistBase, activity_date: { [Op.gte]: today } },
        }),
        ArtistSchedule.count({
          where: { ...artistBase, activity_date: { [Op.lt]: today } },
        }),
        ArtistSchedule.count({ where: artistBase }),
        ArtistSchedule.count({
          where: { ...artistBase, is_public: true },
        }),
      ]);

    res.status(200).json({
      success: true,
      data: items,
      count: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum) || 0,
      summary: {
        upcoming: upcomingCount,
        past: pastCount,
        total: totalAll,
        public: publicCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching schedule",
      error: error.message,
    });
  }
};

const createScheduleItem = async (req, res) => {
  try {
    const {
      title,
      venue,
      city,
      activity_date,
      start_time,
      end_time,
      description,
      external_url,
      is_public,
    } = req.body;

    if (!title || !activity_date) {
      return res.status(400).json({
        success: false,
        message: "Title and activity_date are required",
      });
    }

    const imageUrl = convertToRelativePath(req.file?.path);

    const item = await ArtistSchedule.create({
      artist_id: req.userId,
      title,
      venue,
      city,
      activity_date,
      start_time,
      end_time,
      description,
      external_url,
      image_url: imageUrl,
      is_public: parseBool(is_public, true),
    });

    res.status(201).json({
      success: true,
      message: "Schedule item added",
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating schedule item",
      error: error.message,
    });
  }
};

const updateScheduleItem = async (req, res) => {
  try {
    const item = await ArtistSchedule.findOne({
      where: { id: req.params.scheduleId, artist_id: req.userId },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Schedule item not found",
      });
    }

    const imageUrl = convertToRelativePath(req.file?.path);
    const {
      title,
      venue,
      city,
      activity_date,
      start_time,
      end_time,
      description,
      external_url,
      is_public,
    } = req.body;

    await item.update({
      title: title ?? item.title,
      venue: venue ?? item.venue,
      city: city ?? item.city,
      activity_date: activity_date ?? item.activity_date,
      start_time: start_time ?? item.start_time,
      end_time: end_time ?? item.end_time,
      description: description ?? item.description,
      external_url: external_url ?? item.external_url,
      image_url: imageUrl || item.image_url,
      is_public:
        is_public !== undefined && is_public !== null && is_public !== ""
          ? parseBool(is_public, item.is_public)
          : item.is_public,
    });

    res.status(200).json({
      success: true,
      message: "Schedule item updated",
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating schedule item",
      error: error.message,
    });
  }
};

const deleteScheduleItem = async (req, res) => {
  try {
    const item = await ArtistSchedule.findOne({
      where: { id: req.params.scheduleId, artist_id: req.userId },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Schedule item not found",
      });
    }

    await item.destroy();
    res.status(200).json({
      success: true,
      message: "Schedule item deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting schedule item",
      error: error.message,
    });
  }
};

module.exports = {
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
};
