const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const RECORD_COLLECTION = "meeting_records";

async function ensureRecordCollection() {
  if (!db.createCollection) return;
  await db.createCollection(RECORD_COLLECTION).catch(() => {});
}

async function cleanupOldRecords() {
  await ensureRecordCollection();
  await db.collection(RECORD_COLLECTION)
    .where({
      expireAt: db.command.lt(new Date())
    })
    .remove()
    .catch(() => {});
}

exports.main = async () => {
  try {
    await cleanupOldRecords();
    const result = await db.collection(RECORD_COLLECTION)
      .where({
        visibleToAll: true
      })
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return {
      ok: true,
      records: result.data || []
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "会议记录读取失败",
      records: []
    };
  }
};
