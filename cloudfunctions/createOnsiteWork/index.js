const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "onsite_works";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTaskNoDate(value) {
  const match = String(value || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    const now = new Date();
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  }
  return `${match[1]}${pad(match[2])}${pad(match[3])}`;
}

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
    const day = formatTaskNoDate(work.date);
    let taskNo = work.taskNo || work.no || "";
    if (!taskNo) {
      const existing = await db.collection(COLLECTION)
        .where({ taskNo: db.RegExp({ regexp: `^${day}`, options: "" }) })
        .limit(100)
        .get();
      const maxNo = (existing.data || [])
        .map((item) => Number(String(item.taskNo || "").slice(day.length)))
        .filter((value) => Number.isFinite(value))
        .reduce((max, value) => Math.max(max, value), 0);
      taskNo = `${day}${pad(maxNo + 1)}`;
    }
    const record = {
      ...work,
      taskNo,
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
