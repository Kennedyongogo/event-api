/** Parse organizer lineup from body — strings or { name, role } objects */
const parseLineup = (raw) => {
  if (raw == null || raw === "") return [];

  let items = raw;
  if (typeof raw === "string") {
    try {
      items = JSON.parse(raw);
    } catch {
      items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return { name: item.trim() };
      }
      if (item && typeof item === "object" && item.name) {
        return {
          name: String(item.name).trim(),
          ...(item.role ? { role: String(item.role).trim() } : {}),
        };
      }
      return null;
    })
    .filter(Boolean);
};

module.exports = { parseLineup };
