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

function normalizeRoomId(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "");
}

exports.main = async (event) => {
  try {
    const name = String(event.name || "").trim();
    const capacity = Number(event.capacity);
    const features = String(event.features || "").trim();

    if (!name || !Number.isFinite(capacity) || capacity <= 0) {
      return {
        ok: false,
        message: "请填写会议室名称和有效人数"
      };
    }

    await ensureRoomCollection();
    const existing = await db.collection(ROOM_COLLECTION)
      .where({
        name,
        active: true
      })
      .limit(1)
      .get();

    if (existing.data && existing.data.length) {
      return {
        ok: false,
        message: "会议室已存在"
      };
    }

    const addResult = await db.collection(ROOM_COLLECTION).add({
      data: {
        roomId: normalizeRoomId(name) || `room-${Date.now()}`,
        name,
        capacity,
        features,
        active: true,
        createdAt: new Date()
      }
    });

    return {
      ok: true,
      roomId: addResult._id
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "会议室添加失败"
    };
  }
};
