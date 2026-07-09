const { randomUUID } = require("crypto");

/** Parse event merchandise — [{ name, price, pickup_point, image_url?, quantity_available?, id? }] */
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

      return {
        id: item.id ? String(item.id) : undefined,
        name,
        price,
        pickup_point,
        image_url: item.image_url ? String(item.image_url).trim() : null,
        quantity_available: Number.isNaN(quantity_available)
          ? 0
          : Math.max(0, quantity_available),
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
    };
  });
};

module.exports = { parseMerchandise, mergeMerchandiseWithUploads };
