const { instruments } = require("./mock");

const INSTRUMENT_CATALOG_KEY = "instrumentCatalog";
const INSTRUMENT_CATALOG_CACHE_KEY = "instrumentCatalogCache";

function normalizeInstrument(item = {}, index = 0) {
  const id = item.id || item.instrumentId || `I${String(index + 1).padStart(3, "0")}`;
  return {
    id,
    instrumentId: id,
    code: item.code || id,
    name: item.name || "未命名仪器",
    model: item.model || "",
    stock: Number(item.stock || item.quantity || 1),
    available: Number(item.available || item.stock || item.quantity || 1),
    unit: item.unit || "台",
    location: item.location || "",
    manager: item.manager || "",
    remark: item.remark || ""
  };
}

function getDefaultInstrumentCatalog() {
  return instruments.map(normalizeInstrument);
}

function normalizeInstrumentCatalog(list) {
  const source = Array.isArray(list) && list.length ? list : getDefaultInstrumentCatalog();
  return source.map(normalizeInstrument);
}

function getCachedInstrumentCatalog() {
  return normalizeInstrumentCatalog(wx.getStorageSync(INSTRUMENT_CATALOG_CACHE_KEY));
}

async function loadInstrumentCatalog(options = {}) {
  const fallback = getCachedInstrumentCatalog();
  if (!wx.cloud) return fallback;
  try {
    const res = await wx.cloud.callFunction({
      name: "listAdminConfigs",
      data: { keys: [INSTRUMENT_CATALOG_KEY] }
    });
    const result = res.result || {};
    const remote = result.ok && result.configs ? result.configs[INSTRUMENT_CATALOG_KEY] : null;
    const catalog = normalizeInstrumentCatalog(remote || fallback);
    wx.setStorageSync(INSTRUMENT_CATALOG_CACHE_KEY, catalog);
    if (!remote && options.seed !== false) {
      saveInstrumentCatalog(catalog, options.operator).catch(() => {});
    }
    return catalog;
  } catch (error) {
    return fallback;
  }
}

async function saveInstrumentCatalog(catalog, operator = "") {
  const normalized = normalizeInstrumentCatalog(catalog);
  wx.setStorageSync(INSTRUMENT_CATALOG_CACHE_KEY, normalized);
  if (!wx.cloud) return { ok: false, localOnly: true };
  const res = await wx.cloud.callFunction({
    name: "updateAdminConfig",
    data: {
      key: INSTRUMENT_CATALOG_KEY,
      value: normalized,
      operator
    }
  });
  return res.result || { ok: false };
}

module.exports = {
  INSTRUMENT_CATALOG_KEY,
  getDefaultInstrumentCatalog,
  loadInstrumentCatalog,
  saveInstrumentCatalog
};
