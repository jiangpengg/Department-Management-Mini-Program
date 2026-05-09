const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "onsite_works";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event) => {
  try {
    await ensureCollection();
    const { user, work } = event;
    if (!user || !user.name || !work || !work.title || !work.date || !work.endDate) {
      return { ok: false, message: "缺少现场工作任务、时间或创建人" };
    }
    const wxContext = cloud.getWXContext();
    const record = {
      ...work,
      category: "onsite",
      createdBy: user.name,
      createdById: user.id || "",
      createdByOpenid: wxContext.OPENID || user.openid || "",
      visibleToAll: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection(COLLECTION).add({ data: record });
    return { ok: true, recordId: result._id };
  } catch (error) {
    return { ok: false, message: error.message || "现场工作创建失败" };
  }
};
