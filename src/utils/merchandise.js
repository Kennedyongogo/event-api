const { randomUUID } = require("crypto");
const { normalizeCommissionRate } = require("./commission");

/** Parse event merchandise — [{ name, price, pickup_point, image_url?, quantity_available?, commission_rate?, id? }] */
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
      const pickup_point = String(item.pickup_point || "").trim();
      const price = parseFloat(item.price);

      if (!name || !pickup_point || Number.isNaN(price) || price < 0) {
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
        pickup_point,
        image_url: item.image_url ? String(item.image_url).trim() : null,
        quantity_available: Number.isNaN(quantity_available)
          ? 0
          : Math.max(0, quantity_available),
        ...(commission_rate != null ? { commission_rate } : {}),
      };
    })
    .filter(Boolean);
};

const mergeMerchandiseWithUploads = (rawMerchandise, files = [], convertToRelativePath) => {
  const items = parseMerchandise(rawMerchandise);
  const fileList = Array.isArray(files) ? files : [];

  return items.map((item, index) => {
    const fieldName = `merchandise_image_${index}`;
    const file = fileList.find((f) => f.fieldname === fieldName);
    const image_url = file
      ? convertToRelativePath(file.path)
      : item.image_url || null;

    return {
      id: item.id || randomUUID(),
      name: item.name,
      price: item.price,
      pickup_point: item.pickup_point,
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

    return {
      merchandise_id: catalogItem.id,
      name: catalogItem.name,
      pickup_point: catalogItem.pickup_point,
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
  parseMerchandise,
  mergeMerchandiseWithUploads,
  findMerchandiseItem,
  buildMerchandisePurchaseLines,
  applyMerchandiseStockDelta,
};
