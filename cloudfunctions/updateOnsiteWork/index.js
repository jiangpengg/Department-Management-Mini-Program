const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "onsite_works";

exports.main = async (event) => {
  try {
    const { recordId, data } = event;
    if (!recordId || !data) {
      return { ok: false, message: "缺少现场工作记录或更新内容" };
    }
    await db.collection(COLLECTION).doc(recordId).update({
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message || "现场工作更新失败" };
  }
};
