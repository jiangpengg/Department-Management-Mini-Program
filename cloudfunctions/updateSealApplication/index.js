const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const COLLECTION = "seal_applications";

function canReviewStep(user, record, currentStep) {
  if (!user || !record || record.status !== "pending" || !currentStep) return false;
  const capabilities = user.capabilities || [];
  const isGlobal = capabilities.indexOf("global_admin") >= 0;
  if (currentStep.key === "section") {
    return user.roleKey === "section_manager" && user.department === record.department;
  }
  return isGlobal;
}

exports.main = async (event) => {
  try {
    const { recordId, action, user } = event;
    if (!recordId || !action || !user) {
      return {
        ok: false,
        message: "缺少审批记录、操作或用户信息"
      };
    }

    const result = await db.collection(COLLECTION).doc(recordId).get();
    const record = result.data;
    const flow = record.approvalFlow || [];
    const currentStepIndex = record.currentStepIndex || 0;
    const currentStep = flow[currentStepIndex];
    if (!canReviewStep(user, record, currentStep)) {
      return {
        ok: false,
        message: "当前账号无权审批该步骤"
      };
    }

    let nextStatus = record.status;
    let nextStepIndex = currentStepIndex;
    if (action === "reject") {
      nextStatus = "rejected";
    } else {
      nextStepIndex = currentStepIndex + 1;
      nextStatus = nextStepIndex >= flow.length ? "approved" : "pending";
    }

    const approvalLogs = record.approvalLogs || [];
    approvalLogs.push({
      action,
      step: currentStep ? currentStep.name : "",
      operator: user.name,
      operatorId: user.id || "",
      time: new Date()
    });

    await db.collection(COLLECTION).doc(recordId).update({
      data: {
        status: nextStatus,
        currentStepIndex: nextStepIndex,
        approvalLogs,
        updatedAt: new Date()
      }
    });

    return {
      ok: true,
      status: nextStatus,
      currentStepIndex: nextStepIndex
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "用印审批更新失败"
    };
  }
};
