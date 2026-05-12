const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "instrument_flows";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

function isLifecycleType(type) {
  return type === "出库申请" || type === "归还申请" || type === "仪器归还申请" || String(type || "").indexOf("出库") >= 0 || String(type || "").indexOf("归还") >= 0;
}

function flowKind(type) {
  const text = String(type || "");
  if (text.indexOf("归还") >= 0) return "return";
  if (text.indexOf("出库") >= 0) return "out";
  return "";
}

exports.main = async (event) => {
  try {
    await ensureCollection();
    const { user, record } = event;
    if (!user || !user.name || !record || !record.taskId || !record.type) {
      return { ok: false, message: "缺少任务、设备或申请人" };
    }
    if (isLifecycleType(record.type)) {
      const kind = flowKind(record.type);
      const duplicate = await db.collection(COLLECTION)
        .where({
          taskId: record.taskId,
          visibleToAll: true
        })
        .limit(10)
        .get();
      const existing = (duplicate.data || []).find((item) => (
        flowKind(item.type) === kind && item.status !== "已驳回" && item.approvalStatus !== "rejected"
      ));
      if (existing) {
        return {
          ok: false,
          message: String(record.type).indexOf("归还") >= 0 ? "该任务已提交归还申请" : "该任务已提交出库申请"
        };
      }
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
