const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const RECORD_COLLECTION = "room_bookings";

async function ensureRecordCollection() {
  if (!db.createCollection) return;
  await db.createCollection(RECORD_COLLECTION).catch(() => {});
}

exports.main = async (event) => {
  try {
    await ensureRecordCollection();
    const query = {
      visibleToAll: true
    };
    if (event.date) {
      query.date = event.date;
    }

    const result = await db.collection(RECORD_COLLECTION)
      .where(query)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    return {
      ok: true,
      records: result.data || []
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "会议室占用读取失败",
      records: []
    };
  }
};
