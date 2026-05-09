const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const ROOM_COLLECTION = "meeting_rooms";

async function ensureRoomCollection() {
  if (!db.createCollection) return;
  await db.createCollection(ROOM_COLLECTION).catch(() => {});
}

exports.main = async () => {
  try {
    await ensureRoomCollection();
    const result = await db.collection(ROOM_COLLECTION)
      .where({
        active: true
      })
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    return {
      ok: true,
      rooms: result.data || []
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "会议室读取失败",
      rooms: []
    };
  }
};
