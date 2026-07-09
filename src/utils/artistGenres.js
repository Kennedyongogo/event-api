const MAX_ARTIST_GENRES = 12;

const parseArtistGenres = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parseArtistGenres(parsed) : [];
      } catch {
        return trimmed
          .split(/[,;/|]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }
    return trimmed
      .split(/[,;/|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const resolveArtistGenres = (userLike) => {
  const genres = parseArtistGenres(userLike?.genre);
  return genres.slice(0, MAX_ARTIST_GENRES);
};

const normalizeArtistGenres = (value) => {
  const unique = [];
  for (const genre of parseArtistGenres(value)) {
    if (!unique.includes(genre)) unique.push(genre);
    if (unique.length >= MAX_ARTIST_GENRES) break;
  }
  return unique;
};

const formatGenresDisplay = (value) => resolveArtistGenres({ genre: value }).join(" / ");

const withPortalArtistGenres = (userLike) => {
  const genres = resolveArtistGenres(userLike);
  return {
    ...(userLike?.toJSON ? userLike.toJSON() : { ...userLike }),
    genre: genres,
  };
};

const withPublicArtistGenres = (userLike) => {
  const genres = resolveArtistGenres(userLike);
  return {
    ...(userLike?.toJSON ? userLike.toJSON() : { ...userLike }),
    genres,
    genre: formatGenresDisplay(genres),
  };
};

const parseGenreFromBody = (value) => {
  if (value === undefined) return undefined;
  return normalizeArtistGenres(value);
};

module.exports = {
  MAX_ARTIST_GENRES,
  parseArtistGenres,
  resolveArtistGenres,
  normalizeArtistGenres,
  formatGenresDisplay,
  withPortalArtistGenres,
  withPublicArtistGenres,
  parseGenreFromBody,
};
