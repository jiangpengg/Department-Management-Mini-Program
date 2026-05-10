const { departments, users, roles } = require("./mock");

const ORG_CONFIG_KEY = "orgConfig";
const ORG_CACHE_KEY = "orgConfigCache";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultOrgConfig() {
  return clone({ departments, users, roles });
}

function normalizeOrgConfig(config = {}) {
  const defaults = getDefaultOrgConfig();
  return {
    departments: Array.isArray(config.departments) ? config.departments : defaults.departments,
    users: Array.isArray(config.users) ? config.users : defaults.users,
    roles: Array.isArray(config.roles) ? config.roles : defaults.roles
  };
}

function getCachedOrgConfig() {
  return normalizeOrgConfig(wx.getStorageSync(ORG_CACHE_KEY) || getDefaultOrgConfig());
}

async function loadOrgConfig(options = {}) {
  const fallback = getCachedOrgConfig();
  if (!wx.cloud) return fallback;
  try {
    const res = await wx.cloud.callFunction({
      name: "listAdminConfigs",
      data: { keys: [ORG_CONFIG_KEY] }
    });
    const result = res.result || {};
    const remote = result.ok && result.configs ? result.configs[ORG_CONFIG_KEY] : null;
    const config = normalizeOrgConfig(remote || fallback);
    wx.setStorageSync(ORG_CACHE_KEY, config);

    if (!remote && options.seed !== false) {
      saveOrgConfig(config, options.operator).catch(() => {});
    }
    return config;
  } catch (error) {
    return fallback;
  }
}

async function saveOrgConfig(config, operator = "") {
  const normalized = normalizeOrgConfig(config);
  wx.setStorageSync(ORG_CACHE_KEY, normalized);
  if (!wx.cloud) return { ok: false, localOnly: true };
  const res = await wx.cloud.callFunction({
    name: "updateAdminConfig",
    data: {
      key: ORG_CONFIG_KEY,
      value: normalized,
      operator
    }
  });
  return res.result || { ok: false };
}

module.exports = {
  ORG_CONFIG_KEY,
  getDefaultOrgConfig,
  getCachedOrgConfig,
  loadOrgConfig,
  saveOrgConfig
};
