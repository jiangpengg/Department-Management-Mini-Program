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

function filterByScope(records, user) {
  if (!user) return [];
  if (user.capabilities && user.capabilities.indexOf("global_admin") >= 0) {
    return records;
  }
  if (user.roleKey === "section_manager") {
    return records.filter((item) => item.department === user.department);
  }
  return records.filter((item) => item.applicant === user.name || item.applicantId === user.id);
}

exports.main = async (event) => {
  try {
    await ensureCollection();
    const result = await db.collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    return {
      ok: true,
      records: filterByScope(result.data || [], event.user)
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "用印申请读取失败",
      records: []
    };
  }
};
