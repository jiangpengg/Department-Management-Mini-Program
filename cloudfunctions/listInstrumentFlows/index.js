const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "instrument_flows";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async () => {
  try {
    await ensureCollection();
    const result = await db.collection(COLLECTION)
      .where({ visibleToAll: true })
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return { ok: true, records: result.data || [] };
  } catch (error) {
    return { ok: false, message: error.message || "出入库记录读取失败", records: [] };
  }
};
