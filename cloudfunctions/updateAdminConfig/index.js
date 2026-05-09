const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "admin_configs";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event = {}) => {
  const key = String(event.key || "");
  if (!key) {
    return { ok: false, message: "缺少配置键" };
  }
  try {
    await ensureCollection();
    const now = db.serverDate();
    const payload = {
      key,
      value: event.value,
      operator: event.operator || "",
      updatedAt: now
    };
    const result = await db.collection(COLLECTION).where({ key }).limit(1).get();
    if (result.data && result.data.length) {
      await db.collection(COLLECTION).doc(result.data[0]._id).update({ data: payload });
    } else {
      await db.collection(COLLECTION).add({
        data: {
          ...payload,
          createdAt: now
        }
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "配置保存失败" };
  }
};
