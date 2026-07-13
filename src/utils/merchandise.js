const { randomUUID } = require("crypto");
const { normalizeCommissionRate } = require("./commission");

const PICKUP_TYPES = ["event", "custom", "both"];

const parseCoord = (value) => {
  if (value === "" || value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const normalizePickupType = (value) => {
  const type = String(value || "").trim().toLowerCase();
  if (type === "custom" || type === "both") return type;
  return "event";
};

/** Parse event merchandise — [{ name, price, pickup_point, pickup_type?, pickup_address?, pickup_latitude?, pickup_longitude?, image_url?, quantity_available?, commission_rate?, id? }] */
const parseMerchandise = (raw) => {
  if (raw == null || raw === "") return [];

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const name = String(item.name || "").trim();
      const pickup_type = normalizePickupType(item.pickup_type);
      const pickup_point = String(item.pickup_point || "").trim();
      const pickup_address = String(item.pickup_address || "").trim();
      const pickup_latitude = parseCoord(item.pickup_latitude);
      const pickup_longitude = parseCoord(item.pickup_longitude);
      const price = parseFloat(item.price);

      if (!name || Number.isNaN(price) || price < 0) {
        return null;
      }

      if (pickup_type === "custom") {
        if (!pickup_address || pickup_latitude == null || pickup_longitude == null) {
          return null;
        }
      } else if (pickup_type === "both") {
        if (
          !pickup_point ||
          !pickup_address ||
          pickup_latitude == null ||
          pickup_longitude == null
        ) {
          return null;
        }
      } else if (!pickup_point) {
        return null;
      }

      const qtyRaw = item.quantity_available ?? item.quantity;
      const quantity_available = parseInt(qtyRaw, 10);
      const commission_rate =
        item.commission_rate !== undefined &&
        item.commission_rate !== null &&
        item.commission_rate !== ""
          ? normalizeCommissionRate(item.commission_rate, 10)
          : null;

      return {
        id: item.id ? String(item.id) : undefined,
        name,
        price,
        pickup_type,
        pickup_point,
        pickup_address:
          pickup_type === "custom" || pickup_type === "both" ? pickup_address : null,
        pickup_latitude:
          pickup_type === "custom" || pickup_type === "both"
            ? pickup_latitude
            : null,
        pickup_longitude:
          pickup_type === "custom" || pickup_type === "both"
            ? pickup_longitude
            : null,
        image_url: item.image_url ? normalizeStorageImagePath(item.image_url) : null,
        quantity_available: Number.isNaN(quantity_available)
          ? 0
          : Math.max(0, quantity_available),
        ...(commission_rate != null ? { commission_rate } : {}),
      };
    })
    .filter(Boolean);
};

const normalizeStorageImagePath = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const { pathname } = new URL(trimmed);
      if (pathname.startsWith("/uploads/")) return pathname;
      if (pathname.startsWith("uploads/")) return `/${pathname}`;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (trimmed.startsWith("uploads/")) return `/${trimmed}`;
  return trimmed;
};

const mergeMerchandiseWithUploads = (
  rawMerchandise,
  files = [],
  convertToRelativePath,
  existingMerchandise = []
) => {
  const items = parseMerchandise(rawMerchandise);
  const fileList = Array.isArray(files) ? files : [];
  const existingById = new Map(
    (Array.isArray(existingMerchandise) ? existingMerchandise : [])
      .filter((item) => item?.id)
      .map((item) => [String(item.id), item])
  );

  return items.map((item, index) => {
    const fieldName = `merchandise_image_${index}`;
    const file = fileList.find((f) => f.fieldname === fieldName);
    const previous = item.id ? existingById.get(String(item.id)) : null;
    const image_url = file
      ? convertToRelativePath(file.path)
      : normalizeStorageImagePath(item.image_url) ||
        normalizeStorageImagePath(previous?.image_url) ||
        null;

    return {
      id: item.id || randomUUID(),
      name: item.name,
      price: item.price,
      pickup_type: item.pickup_type || "event",
      pickup_point: item.pickup_point || "",
      pickup_address: item.pickup_address || null,
      pickup_latitude: item.pickup_latitude ?? null,
      pickup_longitude: item.pickup_longitude ?? null,
      image_url,
      quantity_available: item.quantity_available ?? 0,
      ...(item.commission_rate != null
        ? { commission_rate: item.commission_rate }
        : {}),
    };
  });
};

const findMerchandiseItem = (event, merchandiseId) =>
  (event?.merchandise || []).find((item) => item.id === merchandiseId) || null;

const formatPickupSummary = (catalogItem, event, pickupChoice = null) => {
  const type = catalogItem.pickup_type || "event";
  const venue = event?.venue ? String(event.venue).trim() : "";

  const eventSummary = () => {
    if (venue && catalogItem.pickup_point) {
      return `At event (${venue}) — ${catalogItem.pickup_point}`;
    }
    if (venue) return `At event (${venue})`;
    return catalogItem.pickup_point || "At event";
  };

  const customSummary = () => {
    const notes =
      type === "both" ? "" : catalogItem.pickup_point;
    return [catalogItem.pickup_address, notes].filter(Boolean).join(" — ");
  };

  if (pickupChoice === "event") return eventSummary();
  if (pickupChoice === "custom") return customSummary();

  if (type === "custom") return customSummary();
  if (type === "both") {
    return `Either: ${eventSummary()} OR ${customSummary()}`;
  }
  return eventSummary();
};

const resolvePickupChoice = (catalogItem, requestedChoice) => {
  const type = catalogItem.pickup_type || "event";
  const choice = String(requestedChoice || "").trim().toLowerCase();

  if (type === "both") {
    if (choice !== "event" && choice !== "custom") {
      throw new Error(`Choose a pickup location for ${catalogItem.name}`);
    }
    return choice;
  }

  if (type === "custom") return "custom";
  return "event";
};

const buildMerchandisePurchaseLines = (event, requestedItems = []) => {
  if (!Array.isArray(requestedItems) || !requestedItems.length) return [];

  return requestedItems.map((raw) => {
    const merchandiseId = String(raw.merchandise_id || raw.id || "").trim();
    const quantity = parseInt(raw.quantity, 10);

    if (!merchandiseId || Number.isNaN(quantity) || quantity <= 0) {
      throw new Error("Each merchandise item needs a valid id and quantity");
    }

    const catalogItem = findMerchandiseItem(event, merchandiseId);
    if (!catalogItem) {
      throw new Error(`Merchandise item not found: ${merchandiseId}`);
    }
    if ((catalogItem.quantity_available || 0) < quantity) {
      throw new Error(
        `Only ${catalogItem.quantity_available || 0} left for ${catalogItem.name}`
      );
    }

    const pickupChoice = resolvePickupChoice(
      catalogItem,
      raw.pickup_choice ?? raw.pickupChoice
    );

    return {
      merchandise_id: catalogItem.id,
      name: catalogItem.name,
      pickup_type: catalogItem.pickup_type || "event",
      pickup_choice: pickupChoice,
      pickup_point: catalogItem.pickup_point || "",
      pickup_address: catalogItem.pickup_address || null,
      pickup_latitude: catalogItem.pickup_latitude ?? null,
      pickup_longitude: catalogItem.pickup_longitude ?? null,
      pickup_summary: formatPickupSummary(catalogItem, event, pickupChoice),
      image_url: catalogItem.image_url || null,
      unit_price: catalogItem.price,
      quantity,
      commission_rate: catalogItem.commission_rate ?? null,
    };
  });
};

const applyMerchandiseStockDelta = async (event, lines, delta) => {
  const merchandise = Array.isArray(event.merchandise)
    ? event.merchandise.map((item) => ({ ...item }))
    : [];

  for (const line of lines) {
    const index = merchandise.findIndex(
      (item) => item.id === line.merchandise_id
    );
    if (index === -1) {
      throw new Error(`Merchandise item not found: ${line.merchandise_id}`);
    }

    const nextQty = (merchandise[index].quantity_available || 0) + delta * line.quantity;
    if (nextQty < 0) {
      throw new Error(`Insufficient stock for ${merchandise[index].name}`);
    }
    merchandise[index].quantity_available = nextQty;
  }

  await event.update({ merchandise });
  return merchandise;
};

module.exports = {
  PICKUP_TYPES,
  parseMerchandise,
  mergeMerchandiseWithUploads,
  findMerchandiseItem,
  buildMerchandisePurchaseLines,
  applyMerchandiseStockDelta,
  formatPickupSummary,
  resolvePickupChoice,
};
