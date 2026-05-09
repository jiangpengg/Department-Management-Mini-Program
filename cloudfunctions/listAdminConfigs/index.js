const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "admin_configs";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event = {}) => {
  const keys = event.keys || [];
  try {
    await ensureCollection();
    const result = keys.length
      ? await db.collection(COLLECTION).where({ key: db.command.in(keys) }).get()
      : await db.collection(COLLECTION).get();
    const configs = {};
    (result.data || []).forEach((item) => {
      configs[item.key] = item.value;
    });
    return { ok: true, configs };
  } catch (error) {
    return { ok: false, message: error.message || "配置读取失败", configs: {} };
  }
};
