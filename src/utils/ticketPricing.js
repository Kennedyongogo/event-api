/** Parse ticket tier pricing from body — [{ category, price, quantity? }] */
const parseTicketPrices = (raw) => {
  if (raw == null || raw === "") return [];

  let items = raw;
  if (typeof raw === "string") {
    try {
      items = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const category = String(item.category || item.name || "").trim();
      const price = parseFloat(item.price);
      if (!category || Number.isNaN(price) || price < 0) return null;

      const tier = { category, price };
      if (item.quantity != null && item.quantity !== "") {
        const qty = parseInt(item.quantity, 10);
        if (!Number.isNaN(qty) && qty >= 0) {
          tier.quantity = qty;
        }
      }
      return tier;
    })
    .filter(Boolean);
};

const parseVenueCoordinates = (latitude, longitude) => {
  const lat =
    latitude != null && latitude !== "" ? parseFloat(latitude) : null;
  const lng =
    longitude != null && longitude !== "" ? parseFloat(longitude) : null;

  if (lat == null && lng == null) {
    return { venue_latitude: null, venue_longitude: null };
  }

  if (
    lat == null ||
    lng == null ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { error: "Invalid venue coordinates (latitude -90 to 90, longitude -180 to 180)" };
  }

  return { venue_latitude: lat, venue_longitude: lng };
};

const parseTicketsAvailable = (value) => {
  if (value == null || value === "") return null;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return { error: "tickets_available must be a non-negative integer" };
  return { tickets_available: n };
};

const tierLabel = (tier, index) => {
  const name = String(tier.category || tier.name || "").trim();
  return name || `Tier ${index + 1}`;
};

/** Ensure sum of tier quantities does not exceed tickets_available */
const validateTicketTierQuantities = (ticketsAvailable, ticketPrices) => {
  const totalParsed = parseTicketsAvailable(ticketsAvailable);
  if (totalParsed?.error) return totalParsed;

  const available = totalParsed?.tickets_available ?? 0;
  const tiers = Array.isArray(ticketPrices) ? ticketPrices : parseTicketPrices(ticketPrices);

  let totalTierQty = 0;
  const withQty = [];

  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i];
    if (tier.quantity == null || tier.quantity === "") continue;

    const qty = parseInt(tier.quantity, 10);
    const label = tierLabel(tier, i);

    if (Number.isNaN(qty) || qty < 0) {
      return { error: `Invalid quantity for tier "${label}".` };
    }
    if (available <= 0) {
      return {
        error: "Set tickets available before assigning tier quantities.",
      };
    }
    if (qty > available) {
      return {
        error: `Tier "${label}" quantity (${qty}) cannot exceed total tickets available (${available}).`,
      };
    }

    withQty.push({ label, qty });
    totalTierQty += qty;
  }

  if (totalTierQty > available) {
    const over = totalTierQty - available;
    return {
      error: `Total tier quantities (${totalTierQty}) exceed tickets available (${available}) by ${over}. Reduce tier quantities or increase tickets available.`,
    };
  }

  return {
    ok: true,
    tickets_available: available,
    total_tier_quantity: totalTierQty,
    remaining: available - totalTierQty,
  };
};

module.exports = {
  parseTicketPrices,
  parseVenueCoordinates,
  parseTicketsAvailable,
  validateTicketTierQuantities,
};
