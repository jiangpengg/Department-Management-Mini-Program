const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const RECORD_COLLECTION = "meeting_records";
const MCP_URL = "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1";
const SKILL_VERSION = "v1.0.7";

function isOwner(record, event) {
  return Boolean(
    (record.applicantId && event.applicantId && record.applicantId === event.applicantId) ||
    (record.applicantOpenid && event.applicantOpenid && record.applicantOpenid === event.applicantOpenid) ||
    (!record.applicantId && !record.applicantOpenid && record.applicant && event.applicant && record.applicant === event.applicant)
  );
}

function getAccountToken(record) {
  const accountKey = record.accountKey || (record.meeting && record.meeting.accountKey);
  const accountName = record.account || (record.meeting && record.meeting.account);

  if (accountKey === "account2" || accountName === "会议账号2") {
    return process.env.TENCENT_MEETING_TOKEN_2;
  }

  return process.env.TENCENT_MEETING_TOKEN_1 || process.env.TENCENT_MEETING_TOKEN;
}

function requestMcp(method, params, token) {
  if (!token) {
    throw new Error("未找到创建该会议账号对应的腾讯会议 Token");
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

async function cancelTencentMeeting(record) {
  const meeting = record.meeting || {};
  const meetingId = meeting.meetingId || meeting.meeting_id;
  if (!meetingId) {
    throw new Error("记录中缺少腾讯会议 ID，无法取消会议");
  }

  const response = await requestMcp("tools/call", {
    name: "cancel_meeting",
    arguments: {
      meeting_id: String(meetingId),
      _client_info: {
        os: "WeChatMiniProgram",
        agent: "DepartmentManagementMiniProgram",
        model: "cloudfunction"
      }
    }
  }, getAccountToken(record));

  const { parsed, errorMessage } = parseMcpResult(response);
  if (errorMessage && !String(errorMessage).includes("MEETING CANCLED")) {
    throw new Error(errorMessage);
  }

  return parsed;
}

exports.main = async (event) => {
  try {
    const { recordId } = event;
    if (!recordId) {
      return {
        ok: false,
        message: "缺少记录 ID"
      };
    }

    const recordResult = await db.collection(RECORD_COLLECTION).doc(recordId).get();
    const record = recordResult.data;
    if (!record) {
      return {
        ok: false,
        message: "记录不存在"
      };
    }

    if (!isOwner(record, event)) {
      return {
        ok: false,
        message: "只能删除自己申请的会议"
      };
    }

    await cancelTencentMeeting(record);
    await db.collection(RECORD_COLLECTION).doc(recordId).remove();

    return {
      ok: true,
      message: "腾讯会议已取消，申请记录已删除"
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || "删除失败"
    };
  }
};
