const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const RECORD_COLLECTION = "room_bookings";
const ROOM_COLLECTION = "meeting_rooms";
const DEFAULT_ROOM_IDS = ["2010", "413", "small"];

async function ensureRecordCollection() {
  if (!db.createCollection) return;
  await db.createCollection(RECORD_COLLECTION).catch(() => {});
}

function hasConflict(records, startHour, endHour) {
  return records.find((record) => {
    return startHour < Number(record.endHour) && endHour > Number(record.startHour);
  });
}

exports.main = async (event) => {
  try {
    const {
      roomId,
      roomName,
      date,
      startHour,
      endHour,
      startTime,
      endTime,
      title,
      applicant,
      applicantId,
      applicantOpenid
    } = event;

    if (!roomId || !roomName || !date || startHour === undefined || endHour === undefined) {
      return {
        ok: false,
        message: "缺少会议室、日期或时间"
      };
    }

    const start = Number(startHour);
    const end = Number(endHour);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return {
        ok: false,
        message: "会议室时间不正确"
      };
    }

    await ensureRecordCollection();
    const roomResult = await db.collection(ROOM_COLLECTION)
      .where({
        roomId,
        active: true
      })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));
    if ((!roomResult.data || !roomResult.data.length) && DEFAULT_ROOM_IDS.indexOf(roomId) < 0) {
      return {
        ok: false,
        message: "会议室不存在或已停用"
      };
    }

    const existing = await db.collection(RECORD_COLLECTION)
      .where({
        roomId,
        date,
        visibleToAll: true
      })
      .limit(100)
      .get();

    const conflict = hasConflict(existing.data || [], start, end);
    if (conflict) {
      return {
        ok: false,
        message: "该会议室此时间段已被占用",
        conflict: {
          roomName: conflict.roomName,
          title: conflict.title,
          applicant: conflict.applicant,
          startTime: conflict.startTime,
          endTime: conflict.endTime
        }
      };
    }

    const addResult = await db.collection(RECORD_COLLECTION).add({
      data: {
        roomId,
        roomName,
        date,
        startHour: start,
        endHour: end,
        startTime: startTime || `${String(start).padStart(2, "0")}:00`,
        endTime: endTime || `${String(end).padStart(2, "0")}:00`,
        title: title || `${roomName}预约`,
        applicant: applicant || "未填写",
        applicantId: applicantId || "",
        applicantOpenid: applicantOpenid || "",
        visibleToAll: true,
        createdAt: new Date()
      }
    });

    return {
      ok: true,
      recordId: addResult._id
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "会议室占用失败"
    };
  }
};
