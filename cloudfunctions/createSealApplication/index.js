const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const COLLECTION = "seal_applications";

async function ensureCollection() {
  if (!db.createCollection) return;
  await db.createCollection(COLLECTION).catch(() => {});
}

exports.main = async (event) => {
  try {
    await ensureCollection();
    const { user, application } = event;
    if (!user || !user.name || !application || !application.title || !application.sealPhotoPath) {
      return {
        ok: false,
        message: "缺少申请人、标题或盖章文件照片"
      };
    }

    const wxContext = cloud.getWXContext();
    const record = {
      ...application,
      applicant: user.name,
      applicantId: user.id || "",
      applicantRoleKey: user.roleKey || "",
      applicantOpenid: wxContext.OPENID || user.openid || "",
      department: user.department || "",
      status: "pending",
      approvalRequired: true,
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(COLLECTION).add({
      data: record
    });

    return {
      ok: true,
      recordId: result._id
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "用印申请提交失败"
    };
  }
};
