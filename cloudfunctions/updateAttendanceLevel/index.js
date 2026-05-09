const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "attendance_levels";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event = {}) => {
  const userId = String(event.userId || "");
  const level = String(event.level || "");
  if (!userId) {
    return { ok: false, message: "缺少人员ID" };
  }
  if (level && !["1", "2", "3", "4", "5"].includes(level)) {
    return { ok: false, message: "到岗级别无效" };
  }

  try {
    await ensureCollection();
    const now = db.serverDate();
    const query = await db.collection(COLLECTION).where({ userId }).limit(1).get();
    const payload = {
      userId,
      level,
      userName: event.userName || "",
      department: event.department || "",
      operator: event.operator || "",
      updatedAt: now
    };

    if (query.data && query.data.length) {
      await db.collection(COLLECTION).doc(query.data[0]._id).update({
        data: payload
      });
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
    return { ok: false, message: error.message || "到岗级别保存失败" };
  }
};
