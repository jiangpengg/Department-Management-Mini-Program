const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "attendance_levels";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async () => {
  try {
    await ensureCollection();
    const result = await db.collection(COLLECTION)
      .orderBy("updatedAt", "desc")
      .limit(200)
      .get();
    const records = result.data || [];
    const levels = {};
    records.forEach((item) => {
      if (item.userId && item.level) {
        levels[item.userId] = String(item.level);
      }
    });
    return { ok: true, records, levels };
  } catch (error) {
    return { ok: false, message: error.message || "到岗级别读取失败", records: [], levels: {} };
  }
};
