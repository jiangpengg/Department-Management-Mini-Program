const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "instrument_flows";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event) => {
  try {
    await ensureCollection();
    const { user, record } = event;
    if (!user || !user.name || !record || !record.taskId || !record.type) {
      return { ok: false, message: "缺少任务、设备或申请人" };
    }
    const wxContext = cloud.getWXContext();
    const result = await db.collection(COLLECTION).add({
      data: {
        ...record,
        applicant: user.name,
        applicantId: user.id || "",
        applicantOpenid: wxContext.OPENID || user.openid || "",
        visibleToAll: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    return { ok: true, recordId: result._id };
  } catch (error) {
    return { ok: false, message: error.message || "出入库申请提交失败" };
  }
};
