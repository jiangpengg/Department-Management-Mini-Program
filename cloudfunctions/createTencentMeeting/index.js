const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MCP_URL = "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1";
const SKILL_VERSION = "v1.0.7";
const RECORD_COLLECTION = "meeting_records";

function requestMcp(method, params, token) {
  if (!token) {
    throw new Error("云函数环境变量 TENCENT_MEETING_TOKEN_1/TENCENT_MEETING_TOKEN_2 未配置");
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id: 1
  });

  return new Promise((resolve, reject) => {
    const req = https.request(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Tencent-Meeting-Token": token,
        "X-Skill-Version": SKILL_VERSION
      },
      timeout: 15000
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : {},
            rawText: data
          });
        } catch (error) {
          reject(new Error(`腾讯会议响应解析失败: ${error.message}; 原始响应: ${data}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("腾讯会议 MCP 请求超时"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function pickTrace(headers) {
  return headers["x-tc-trace"] || headers["X-Tc-Trace"] || "";
}

function pickRpcUuid(headers) {
  return headers.rpcuuid || headers.rpcUuid || headers["rpcuuid"] || "";
}

function parseMcpResult(response) {
  const result = response.data && response.data.result;
  if (!result) {
    return {
      parsed: response.data,
      errorMessage: response.data && response.data.error && response.data.error.message
    };
  }

  if (result.error) {
    return {
      parsed: result.error,
      errorMessage: result.error.message || JSON.stringify(result.error)
    };
  }

  const contentText = result.content && result.content[0] && result.content[0].text;
  if (!contentText) {
    return {
      parsed: response.data,
      errorMessage: ""
    };
  }

  try {
    const parsed = JSON.parse(contentText);
    if (parsed && typeof parsed.body === "string") {
      return {
        parsed: JSON.parse(parsed.body),
        errorMessage: ""
      };
    }
    return {
      parsed,
      errorMessage: ""
    };
  } catch (error) {
    return {
      parsed: contentText,
      errorMessage: `腾讯会议内容解析失败: ${error.message}`
    };
  }
}

function buildRawPreview(value) {
  if (!value) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function getMeetingTokens() {
  const tokens = [
    { key: "account1", name: "会议账号1", token: process.env.TENCENT_MEETING_TOKEN_1 || process.env.TENCENT_MEETING_TOKEN },
    { key: "account2", name: "会议账号2", token: process.env.TENCENT_MEETING_TOKEN_2 }
  ].filter((item) => item.token);
  return tokens;
}

async function callTool(token, name, args) {
  const response = await requestMcp("tools/call", {
    name,
    arguments: {
      ...args,
      _client_info: {
        os: "WeChatMiniProgram",
        agent: "DepartmentManagementMiniProgram",
        model: "cloudfunction"
      }
    }
  }, token);
  const { parsed, errorMessage } = parseMcpResult(response);
  return {
    response,
    parsed,
    errorMessage,
    trace: pickTrace(response.headers),
    rpcUuid: pickRpcUuid(response.headers)
  };
}

function collectMeetings(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectMeetings);
  if (typeof value !== "object") return [];

  const direct = [];
  ["meeting_info_list", "meeting_list", "meetings", "meeting_list_info"].forEach((key) => {
    if (Array.isArray(value[key])) {
      direct.push(...value[key]);
    }
  });

  return direct.concat(Object.keys(value).flatMap((key) => collectMeetings(value[key])));
}

function getMeetingStart(meeting) {
  return meeting.start_time || meeting.startTime || meeting.start_time_stamp || meeting.start_timestamp || meeting.startTimeStamp || meeting.meeting_start_time || meeting.start || meeting.start_at || meeting.begin_time || meeting.beginTime || "";
}

function getMeetingEnd(meeting) {
  return meeting.end_time || meeting.endTime || meeting.end_time_stamp || meeting.end_timestamp || meeting.endTimeStamp || meeting.meeting_end_time || meeting.end || meeting.end_at || meeting.finish_time || meeting.finishTime || "";
}

function parseMeetingTime(value) {
  if (typeof value === "number") {
    return value > 1000000000000 ? value : value * 1000;
  }
  if (/^\d+$/.test(String(value))) {
    const numberValue = Number(value);
    return numberValue > 1000000000000 ? numberValue : numberValue * 1000;
  }
  return Date.parse(value);
}

function hasConflict(meetings, startTime, endTime) {
  const start = parseMeetingTime(startTime);
  const end = parseMeetingTime(endTime);
  return meetings.find((meeting) => {
    const meetingStart = parseMeetingTime(getMeetingStart(meeting));
    const meetingEnd = parseMeetingTime(getMeetingEnd(meeting));
    if (!Number.isFinite(meetingStart) || !Number.isFinite(meetingEnd)) return false;
    return start < meetingEnd && end > meetingStart;
  });
}

function getDayRange(time) {
  const day = String(time).slice(0, 10);
  return {
    start: `${day}T00:00:00+08:00`,
    end: `${day}T23:59:59+08:00`
  };
}

function dedupeMeetings(meetings) {
  const seen = {};
  return meetings.filter((meeting) => {
    const key = meeting.meeting_id || meeting.meetingId || meeting.meeting_code || meeting.meetingCode || `${getMeetingStart(meeting)}-${getMeetingEnd(meeting)}-${meeting.subject || ""}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

async function queryMeetings(account, name, args) {
  const result = await callTool(account.token, name, args);
  return {
    meetings: result.errorMessage ? [] : collectMeetings(result.parsed),
    errorMessage: result.errorMessage,
    trace: result.trace,
    rpcUuid: result.rpcUuid,
    raw: result.parsed
  };
}

async function listAccountMeetings(account, startTime) {
  const range = getDayRange(startTime);
  const queries = [
    {
      name: "get_user_meetings",
      args: {
        is_show_all_sub_meetings: 0
      }
    },
    {
      name: "get_user_meetings",
      args: {
        pos: range.start,
        cursory: range.start,
        is_show_all_sub_meetings: 0
      }
    },
    {
      name: "get_user_ended_meetings",
      args: {
        start_time: range.start,
        end_time: range.end,
        page_size: 20,
        page_number: 1
      }
    }
  ];

  const results = [];
  for (const query of queries) {
    try {
      results.push(await queryMeetings(account, query.name, query.args));
    } catch (error) {
      results.push({
        meetings: [],
        errorMessage: error.message || "查询会议失败",
        trace: "",
        rpcUuid: "",
        raw: null
      });
    }
  }

  const meetings = dedupeMeetings(results.flatMap((result) => result.meetings));
  const firstSuccess = results.find((result) => !result.errorMessage);
  const firstError = results.find((result) => result.errorMessage);

  return {
    meetings,
    errorMessage: firstSuccess ? "" : (firstError && firstError.errorMessage),
    trace: firstSuccess ? firstSuccess.trace : (firstError && firstError.trace),
    rpcUuid: firstSuccess ? firstSuccess.rpcUuid : (firstError && firstError.rpcUuid),
    querySummary: results.map((result, index) => ({
      index,
      count: result.meetings.length,
      errorMessage: result.errorMessage || ""
    }))
  };
}

async function listLocalRecordMeetings(account) {
  await cleanupOldRecords();
  const result = await db.collection(RECORD_COLLECTION)
    .where({
      visibleToAll: true
    })
    .limit(100)
    .get()
    .catch(() => ({ data: [] }));
  return (result.data || []).filter((record) => {
    return record.accountKey === account.key || record.account === account.name || (record.meeting && record.meeting.account === account.name);
  });
}

async function scheduleMeeting(account, title, startTime, endTime) {
  const result = await callTool(account.token, "schedule_meeting", {
    subject: title,
    start_time: startTime,
    end_time: endTime,
    time_zone: "Asia/Shanghai",
    meeting_type: 0
  });
  const meeting = result.parsed && result.parsed.meeting_info_list && result.parsed.meeting_info_list[0];
  return {
    ...result,
    meeting
  };
}

function getNextShanghaiMidnight() {
  const now = new Date();
  const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() + 1,
    -8,
    0,
    0
  ));
}

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

async function saveMeetingRecord(record) {
  await cleanupOldRecords();
  const expireAt = getNextShanghaiMidnight();
  await db.collection(RECORD_COLLECTION).add({
    data: {
      ...record,
      visibleToAll: true,
      createdAt: new Date(),
      expireAt
    }
  }).catch(() => {});
}

exports.main = async (event) => {
  try {
    const { title, startTime, endTime, applicant, applicantId, applicantOpenid } = event;
    if (!title || !startTime || !endTime) {
      return {
        ok: false,
        message: "缺少会议主题、开始时间或结束时间"
      };
    }

    const accounts = getMeetingTokens();
    if (!accounts.length) {
      return {
        ok: false,
        message: "请配置 TENCENT_MEETING_TOKEN_1，第二个账号配置 TENCENT_MEETING_TOKEN_2"
      };
    }

    const attempts = [];
    for (const account of accounts) {
      const listResult = await listAccountMeetings(account, startTime);
      if (listResult.errorMessage) {
        attempts.push({
          account: account.name,
          conflict: true,
          message: listResult.errorMessage,
          trace: listResult.trace,
          rpcUuid: listResult.rpcUuid,
          querySummary: listResult.querySummary
        });
        continue;
      }

      const conflict = hasConflict(listResult.meetings, startTime, endTime);
      if (conflict) {
        attempts.push({
          account: account.name,
          conflict: true,
          message: "该账号时间冲突",
          conflictMeeting: {
            subject: conflict.subject || conflict.meeting_subject || conflict.title || "",
            startTime: getMeetingStart(conflict),
            endTime: getMeetingEnd(conflict)
          },
          source: "tencent",
          trace: listResult.trace,
          rpcUuid: listResult.rpcUuid,
          querySummary: listResult.querySummary
        });
        continue;
      }

      const localRecords = await listLocalRecordMeetings(account);
      const localConflict = hasConflict(localRecords, startTime, endTime);
      if (localConflict) {
        attempts.push({
          account: account.name,
          conflict: true,
          message: "该账号在今日申请记录中已有冲突会议",
          conflictMeeting: {
            subject: localConflict.title || "",
            startTime: localConflict.startTime,
            endTime: localConflict.endTime
          },
          source: "local",
          querySummary: listResult.querySummary
        });
        continue;
      }

      const scheduleResult = await scheduleMeeting(account, title, startTime, endTime);
      if (!scheduleResult.meeting) {
        attempts.push({
          account: account.name,
          conflict: false,
          message: scheduleResult.errorMessage || "腾讯会议创建失败",
          trace: scheduleResult.trace,
          rpcUuid: scheduleResult.rpcUuid,
          rawPreview: buildRawPreview(scheduleResult.parsed)
        });
        continue;
      }

      const meeting = {
        meetingId: scheduleResult.meeting.meeting_id,
        meetingCode: scheduleResult.meeting.meeting_code,
        joinUrl: scheduleResult.meeting.join_url,
        subject: scheduleResult.meeting.subject,
        startTime: scheduleResult.meeting.start_time,
        endTime: scheduleResult.meeting.end_time,
        account: account.name,
        accountKey: account.key
      };

      await saveMeetingRecord({
        title,
        applicant: applicant || "未填写",
        applicantId: applicantId || "",
        applicantOpenid: applicantOpenid || "",
        startTime,
        endTime,
        account: account.name,
        accountKey: account.key,
        meeting
      });

      return {
        ok: true,
        message: `腾讯会议创建成功（${account.name}）`,
        meeting,
        attempts,
        trace: scheduleResult.trace,
        rpcUuid: scheduleResult.rpcUuid
      };
    }

    return {
      ok: false,
      message: "两个腾讯会议账号在该时间段都冲突或不可用，无法创建会议",
      attempts
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "云函数调用失败",
      rawPreview: error.stack || ""
    };
  }
};
