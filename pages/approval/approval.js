const { applications } = require("../../utils/mock");
const { ensureAuthorized, hasCapability, getCurrentUser, canManageSystem } = require("../../utils/auth");

const TEXT = {
  pending: "\u5f85\u5ba1\u6279",
  approved: "\u5df2\u901a\u8fc7",
  rejected: "\u5df2\u9a73\u56de",
  waiting: "\u5f85\u5904\u7406",
  review: "\u5f85\u5ba1\u67e5",
  all: "\u5168\u90e8",
  reject: "\u9a73\u56de",
  warehouse: "\u4ed3\u5e93\u7ba1\u7406\u5458",
  instrumentAdmin: "\u4eea\u5668\u7ba1\u7406\u5458",
  instrumentBorrow: "\u4eea\u5668\u501f\u7528",
  instrumentReturn: "\u4eea\u5668\u5f52\u8fd8",
  borrowTitle: "\u4eea\u5668\u51fa\u5e93\u7533\u8bf7",
  returnTitle: "\u4eea\u5668\u5f52\u8fd8\u7533\u8bf7",
  pass: "\u901a\u8fc7",
  confirmOut: "\u786e\u8ba4\u51fa\u5e93",
  confirmIn: "\u786e\u8ba4\u5165\u5e93",
  instrumentDetail: "\u4eea\u5668\u660e\u7ec6",
  unlinked: "\u672a\u5173\u8054",
  configWriteFail: "\u914d\u7f6e\u5199\u5165\u5931\u8d25",
  approvalSaveFail: "\u5ba1\u6279\u4fdd\u5b58\u5931\u8d25",
  cloudApprovalFail: "\u4e91\u7aef\u5ba1\u6279\u5931\u8d25"
};

const STATUS = {
  out: "\u51fa\u5e93\u7533\u8bf7",
  back: "\u5f52\u8fd8\u7533\u8bf7",
  waitApproval: "\u5f85\u5ba1\u6279",
  waitConfirm: "\u5f85\u4ed3\u5e93\u7ba1\u7406\u5458\u786e\u8ba4",
  outDone: "\u5df2\u51fa\u5e93",
  inDone: "\u5df2\u5165\u5e93",
  rejected: "\u5df2\u9a73\u56de"
};

function statusMeta(status) {
  const map = {
    pending: { text: TEXT.pending, tone: "amber" },
    approved: { text: TEXT.approved, tone: "green" },
    rejected: { text: TEXT.rejected, tone: "red" }
  };
  return map[status] || { text: TEXT.waiting, tone: "amber" };
}

function getOnsiteConfigActionType(record = {}) {
  if (record.actionType) return record.actionType;
  const title = record.title || "";
  if (title.indexOf("\u65b0\u589e") >= 0) return "add";
  if (title.indexOf("\u4fee\u6539") >= 0) return "edit";
  return "";
}

function formatConfigEquipmentLine(equipment = {}) {
  return `${equipment.name || "\u672a\u547d\u540d\u4eea\u5668"} \u00d7 ${Number(equipment.quantity) || 1}`;
}

function formatConfigEquipmentList(list = []) {
  return (list || []).map(formatConfigEquipmentLine).join("\u3001") || "\u672a\u914d\u7f6e\u4eea\u5668";
}

function buildOnsiteConfigChangeLines(record = {}) {
  if (record.changeLines && record.changeLines.length) return record.changeLines;
  const actionType = getOnsiteConfigActionType(record);
  const submittedProject = record.submittedProject
    || ((record.projectConfigs || []).find((item) => item.key === record.projectKey) || {});
  const previousProject = record.previousProject || null;
  const projectName = submittedProject.name || record.projectName || (previousProject && previousProject.name) || "\u672a\u547d\u540d\u8bd5\u9a8c\u9879\u76ee";
  if (actionType === "add") {
    return [
      `\u65b0\u589e\u9879\u76ee\uff1a${projectName}`,
      `\u4eea\u5668\u6e05\u5355\uff1a${formatConfigEquipmentList(submittedProject.equipment)}`
    ];
  }
  if (actionType === "edit") {
    return [
      `\u4fee\u6539\u9879\u76ee\uff1a${projectName}`,
      `\u4fee\u6539\u524d\uff1a${formatConfigEquipmentList((previousProject || {}).equipment)}`,
      `\u4fee\u6539\u540e\uff1a${formatConfigEquipmentList(submittedProject.equipment)}`
    ];
  }
  return [];
}

function formatEquipmentLine(equipment = {}) {
  const meta = [equipment.model, equipment.code || equipment.instrumentId].filter(Boolean).join(" / ");
  return `${cleanInstrumentDisplayText(equipment.name, TEXT.instrumentDetail)}${meta ? ` (${meta})` : ""} \u00d7 ${Number(equipment.quantity) || 1}`;
}

function normalizeInstrumentText(value) {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/脳/g, "\u00d7")
    .replace(/銆?/g, "\u3001")
    .replace(/锛?/g, "\uff08")
    .replace(/锛塦/g, "\uff09")
    .replace(/鍑哄簱鐢宠/g, STATUS.out)
    .replace(/褰掕繕鐢宠/g, STATUS.back)
    .replace(/宸插嚭搴?/g, STATUS.outDone)
    .replace(/宸插叆搴?/g, STATUS.inDone)
    .replace(/寰呬粨搴撶鐞嗗憳纭/g, STATUS.waitConfirm)
    .replace(/寰呭鎵?/g, STATUS.waitConfirm);
}

function looksCorruptInstrumentText(value) {
  const text = String(value || "");
  const bracketCount = (text.match(/[（(]/g) || []).length;
  return /[鍑褰宸寰锛銆脳]|&#x|&#\d|[（(]\s*、|、\s*[（(]/.test(text) || bracketCount >= 4;
}

function recoverCorruptTaskTitle(value) {
  const text = normalizeInstrumentText(value);
  const chars = [];
  const pattern = /[（(]\s*、\s*[（(]?\s*([\u4e00-\u9fa5A-Za-z0-9])/g;
  let match = pattern.exec(text);
  while (match) {
    chars.push(match[1]);
    match = pattern.exec(text);
  }
  const recovered = chars.join("");
  if (recovered.length >= 2) return recovered;
  const stripped = text
    .replace(/[（(）、,\s]/g, "")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
  return stripped.length >= 2 && stripped.length <= 30 ? stripped : "";
}

function pickTaskTitle(candidates, fallback) {
  for (let i = 0; i < candidates.length; i += 1) {
    const raw = candidates[i];
    if (!raw) continue;
    const recovered = recoverCorruptTaskTitle(raw);
    if (recovered) return recovered;
    if (!looksCorruptInstrumentText(raw)) return normalizeInstrumentText(raw);
  }
  return fallback;
}

function cleanInstrumentDisplayText(value, fallback = TEXT.instrumentDetail) {
  const recovered = recoverCorruptTaskTitle(value);
  if (recovered) return recovered;
  return looksCorruptInstrumentText(value) ? fallback : normalizeInstrumentText(value || fallback);
}

function isOutFlow(record = {}) {
  const type = normalizeInstrumentText(record.type);
  return type === STATUS.out || type.indexOf("\u51fa\u5e93") >= 0;
}

function isReturnFlow(record = {}) {
  const type = normalizeInstrumentText(record.type);
  return type === STATUS.back || type.indexOf("\u5f52\u8fd8") >= 0;
}

function isOutDone(record = {}) {
  return normalizeInstrumentText(record.status) === STATUS.outDone;
}

function isInDone(record = {}) {
  return normalizeInstrumentText(record.status) === STATUS.inDone;
}

Page({
  data: {
    filters: [],
    activeFilter: "review",
    applications: [],
    visibleApplications: [],
    warehouseMembers: [],
    instrumentDetailVisible: false,
    instrumentDetailRecord: null
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    this.setData({
      filters: this.buildFilters(),
      activeFilter: "review"
    });
    this.loadApplications();
  },

  onShow() {
    if (this.getTabBar) this.getTabBar().setData({ selected: 1 });
    this.loadApplications();
  },

  buildFilters() {
    if (canManageSystem()) {
      return [
        { key: "review", name: TEXT.review },
        { key: "all", name: TEXT.all }
      ];
    }
    return [
      { key: "review", name: TEXT.review },
      { key: "rejected", name: TEXT.reject },
      { key: "all", name: TEXT.all }
    ];
  },

  async loadApplications() {
    const loadId = (this._approvalLoadId || 0) + 1;
    this._approvalLoadId = loadId;
    if ((this.data.visibleApplications || []).some((item) => item.source === "instrument" && looksCorruptInstrumentText(item.displayTitle || item.title || item.displayDetail || item.detail))) {
      this.setData({ visibleApplications: [] });
    }
    await this.loadApprovalRoleMembers();
    const cloudSealApplications = await this.loadCloudSealApplications();
    const onsiteTaskMap = await this.loadCloudOnsiteTaskMap();
    const cloudInstrumentApplications = await this.loadCloudInstrumentApplications(onsiteTaskMap);
    const onsiteConfigApplications = await this.loadOnsiteConfigApplications();
    const localSealApplications = wx.getStorageSync("sealApplications") || [];
    const cloudIds = cloudSealApplications.map((item) => item.id || item._id);
    const localFallback = localSealApplications.filter((item) => cloudIds.indexOf(item.id) < 0);
    const user = getCurrentUser();
    const list = applications
      .concat(cloudSealApplications, cloudInstrumentApplications, onsiteConfigApplications, localFallback)
      .filter((item) => item.approvalRequired)
      .filter((item) => {
        if (canManageSystem()) return true;
        if (item.source === "instrument" || item.source === "onsiteConfig") {
          return item.applicant === user.name || hasCapability("system_config") || this.data.warehouseMembers.indexOf(user.name) >= 0;
        }
        if (user.roleKey === "section_manager") return item.department === user.department;
        return item.applicant === user.name;
      })
      .map((item) => {
        const meta = statusMeta(item.status);
        return this.decorateApplication({ ...item, statusText: meta.text, statusTone: meta.tone });
      });
    if (loadId !== this._approvalLoadId) return;
    this.setData({ applications: list }, this.applyFilter);
  },

  async loadApprovalRoleMembers() {
    if (!wx.cloud) return;
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["compositeRoles"] }
      });
      const result = res.result || {};
      const roles = result.ok && result.configs ? (result.configs.compositeRoles || []) : [];
      const warehouse = roles.find((item) => item.key === "warehouse" || item.name === TEXT.warehouse) || {};
      this.setData({ warehouseMembers: warehouse.members || [] });
    } catch (error) {}
  },

  async loadCloudSealApplications() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listSealApplications",
        data: { user: getCurrentUser() }
      });
      const result = res.result || {};
      return result.ok ? (result.records || []) : [];
    } catch (error) {
      return [];
    }
  },

  async loadCloudOnsiteTaskMap() {
    if (!wx.cloud) return {};
    try {
      const res = await wx.cloud.callFunction({ name: "listOnsiteWorks" });
      const result = res.result || {};
      if (!result.ok) return {};
      return (result.records || []).reduce((map, item) => {
        if (item.id) map[item.id] = item;
        if (item._id) map[item._id] = item;
        if (item.taskNo) map[item.taskNo] = item;
        if (item.no) map[item.no] = item;
        return map;
      }, {});
    } catch (error) {
      return {};
    }
  },

  async loadCloudInstrumentApplications(onsiteTaskMap = {}) {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({ name: "listInstrumentFlows" });
      const result = res.result || {};
      if (!result.ok) return [];
      return (result.records || [])
        .filter((item) => isOutFlow(item) || isReturnFlow(item) || item.approvalRequired || item.approvalStatus || item.status === STATUS.waitApproval || item.status === STATUS.waitConfirm)
        .map((item) => this.convertInstrumentFlowToApplication(item, onsiteTaskMap));
    } catch (error) {
      return [];
    }
  },

  async loadOnsiteConfigApplications() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["onsiteConfigApprovals"] }
      });
      const result = res.result || {};
      return result.ok && result.configs
        ? (result.configs.onsiteConfigApprovals || []).map((item) => ({
          ...item,
          changeLines: buildOnsiteConfigChangeLines(item)
        }))
        : [];
    } catch (error) {
      return [];
    }
  },

  convertInstrumentFlowToApplication(record, onsiteTaskMap = {}) {
    const normalizedStatus = normalizeInstrumentText(record.status);
    const isReturn = isReturnFlow(record);
    const linkedTask = onsiteTaskMap[record.taskId] || onsiteTaskMap[record.taskNo] || {};
    const taskNo = record.taskNo || linkedTask.taskNo || "";
    const taskTitle = pickTaskTitle(
      [linkedTask.title, record.taskTitle, record.purpose],
      taskNo ? "\u73b0\u573a\u5de5\u4f5c" : (isReturn ? TEXT.returnTitle : TEXT.borrowTitle)
    );
    const isPendingApproval = record.approvalStatus === "pending" || record.status === STATUS.waitApproval;
    const needsInventoryConfirm = normalizedStatus === STATUS.waitConfirm || record.approvalStatus === "approved";
    const isClosed = isOutDone(record) || isInDone(record) || record.approvalStatus === "completed";
    const status = record.approvalStatus === "rejected" ? "rejected" : (isClosed ? "approved" : "pending");
    const equipmentLines = (record.equipmentDetails || []).map(formatEquipmentLine);
    const equipmentText = cleanInstrumentDisplayText(record.instrumentName, equipmentLines.join("\u3001") || TEXT.instrumentDetail);
    const approvalFlow = [{ key: "instrument_admin", name: isReturn ? TEXT.confirmIn : TEXT.confirmOut, role: TEXT.warehouse }];
    const fallbackTitle = `${taskNo ? "\u73b0\u573a\u5de5\u4f5c" : (isReturn ? TEXT.returnTitle : TEXT.borrowTitle)}${taskNo ? ` ${taskNo}` : ""}`;
    const rawDisplayTitle = `${taskTitle}${taskNo ? ` ${taskNo}` : ""}`;
    const displayTitle = looksCorruptInstrumentText(rawDisplayTitle) ? fallbackTitle : rawDisplayTitle;
    const displayDetail = `\u5173\u8054\u73b0\u573a\u5de5\u4f5c\uff1a${displayTitle || TEXT.unlinked}`;
    return {
      ...record,
      source: "instrument",
      type: isReturn ? TEXT.instrumentReturn : TEXT.instrumentBorrow,
      taskNo,
      title: displayTitle,
      displayTitle,
      applicant: record.applicant || record.borrower || "",
      department: record.department || "",
      time: record.time || "",
      status,
      approvalRequired: true,
      needsInventoryConfirm: true,
      approveText: isReturn ? TEXT.confirmIn : TEXT.confirmOut,
      detail: displayDetail,
      displayDetail,
      equipmentLines: equipmentLines.length ? equipmentLines : [equipmentText || TEXT.instrumentDetail],
      approvalFlow: isPendingApproval || needsInventoryConfirm ? approvalFlow : [],
      currentStepIndex: 0
    };
  },

  switchFilter(event) {
    this.setData({ activeFilter: event.currentTarget.dataset.key }, this.applyFilter);
  },

  applyFilter() {
    const { activeFilter, applications: list } = this.data;
    if (activeFilter === "review") {
      this.setData({ visibleApplications: list.filter((item) => item.status === "pending" && item.canReview) });
      return;
    }
    this.setData({ visibleApplications: activeFilter === "all" ? list : list.filter((item) => item.status === activeFilter) });
  },

  decorateApplication(item) {
    const flow = item.approvalFlow || [];
    const currentStep = flow[item.currentStepIndex || 0];
    const displayItem = this.ensureCleanApplicationDisplay(item);
    return {
      ...displayItem,
      currentStepText: displayItem.status === "pending" && currentStep ? currentStep.name : "",
      canReview: this.canReviewStep(displayItem, currentStep)
    };
  },

  ensureCleanApplicationDisplay(item) {
    if (item.source !== "instrument") {
      return {
        ...item,
        displayTitle: item.displayTitle || item.title || "",
        displayDetail: item.displayDetail || item.detail || ""
      };
    }
    const taskNo = item.taskNo || "";
    const fallbackTitle = `${taskNo ? "\u73b0\u573a\u5de5\u4f5c" : TEXT.instrumentBorrow}${taskNo ? ` ${taskNo}` : ""}`;
    const titleCandidate = item.displayTitle || item.title || item.taskTitle || item.purpose || "";
    const cleanTitle = looksCorruptInstrumentText(titleCandidate)
      ? (recoverCorruptTaskTitle(titleCandidate) || fallbackTitle)
      : normalizeInstrumentText(titleCandidate || fallbackTitle);
    const displayTitle = looksCorruptInstrumentText(cleanTitle) ? fallbackTitle : cleanTitle;
    const displayDetail = `\u5173\u8054\u73b0\u573a\u5de5\u4f5c\uff1a${displayTitle}`;
    return {
      ...item,
      title: displayTitle,
      detail: displayDetail,
      displayTitle,
      displayDetail,
      equipmentLines: (item.equipmentLines || []).map((line) => cleanInstrumentDisplayText(line, TEXT.instrumentDetail))
    };
  },

  canReviewStep(item, currentStep) {
    if (item.status !== "pending" || !currentStep) return false;
    const user = getCurrentUser();
    if (currentStep.key === "section") return user.roleKey === "section_manager" && user.department === item.department;
    if (currentStep.key === "institute") return canManageSystem();
    if (item.source === "instrument" || currentStep.key === "instrument_admin" || currentStep.key === "instrument_confirm") {
      return canManageSystem() || hasCapability("system_config") || this.data.warehouseMembers.indexOf(user.name) >= 0;
    }
    return canManageSystem();
  },

  openInstrumentDetail(event) {
    const id = event.currentTarget.dataset.id;
    const record = this.data.applications.find((item) => item.id === id || item._id === id);
    if (!record) return;
    this.setData({
      instrumentDetailVisible: true,
      instrumentDetailRecord: record
    });
  },

  closeInstrumentDetail() {
    this.setData({
      instrumentDetailVisible: false,
      instrumentDetailRecord: null
    });
  },

  async handleApproval(event) {
    const { id, action } = event.currentTarget.dataset;
    const target = this.data.applications.find((item) => item.id === id || item._id === id);
    if (target && (target._id || target.source === "onsiteConfig")) {
      const updated = await this.updateCloudApplication(target, action);
      if (!updated) return;
      await this.loadApplications();
    }
  },

  async updateCloudApplication(item, action) {
    if (!wx.cloud) return true;
    if (item.source === "instrument") return this.updateCloudInstrumentApplication(item, action);
    if (item.source === "onsiteConfig") return this.updateOnsiteConfigApplication(item, action);
    try {
      const res = await wx.cloud.callFunction({
        name: "updateSealApplication",
        data: { recordId: item._id, action, user: getCurrentUser() }
      });
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({ title: result.message || TEXT.cloudApprovalFail, icon: "none" });
        return false;
      }
      return true;
    } catch (error) {
      wx.showToast({ title: TEXT.cloudApprovalFail, icon: "none" });
      return false;
    }
  },

  async updateCloudInstrumentApplication(item, action) {
    try {
      const approved = action === "approve";
      const isReturn = item.type === TEXT.instrumentReturn || isReturnFlow(item);
      const data = approved
        ? {
          approvalStatus: "completed",
          status: isReturn ? STATUS.inDone : STATUS.outDone,
          currentStepIndex: 0,
          approvedBy: getCurrentUser().name,
          confirmedBy: getCurrentUser().name,
          rejectedBy: ""
        }
        : {
          approvalStatus: "rejected",
          status: STATUS.rejected,
          currentStepIndex: 0,
          approvedBy: "",
          confirmedBy: "",
          rejectedBy: getCurrentUser().name
        };
      const res = await wx.cloud.callFunction({
        name: "updateInstrumentFlow",
        data: { recordId: item._id, data }
      });
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({ title: result.message || TEXT.cloudApprovalFail, icon: "none" });
        return false;
      }
      return true;
    } catch (error) {
      wx.showToast({ title: TEXT.cloudApprovalFail, icon: "none" });
      return false;
    }
  },

  async updateOnsiteConfigApplication(item, action) {
    try {
      const listRes = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["onsiteConfigApprovals"] }
      });
      const listResult = listRes.result || {};
      const records = listResult.ok && listResult.configs ? (listResult.configs.onsiteConfigApprovals || []) : [];
      const itemActionType = getOnsiteConfigActionType(item);
      const isRejectedEdit = action === "reject" && itemActionType === "edit";
      const nextRecords = isRejectedEdit
        ? records.filter((record) => !(record.id === item.id || (
          record.source === "onsiteConfig"
          && getOnsiteConfigActionType(record) === "edit"
          && (!item.projectKey || !record.projectKey || record.projectKey === item.projectKey)
          && record.applicant === item.applicant
          && record.status === "pending"
        )))
        : records.map((record) => (
          record.id === item.id
            ? { ...record, status: action === "approve" ? "approved" : "rejected", currentStepIndex: 1, reviewedBy: getCurrentUser().name }
            : record
        ));
      if (action === "approve") {
        const configRes = await wx.cloud.callFunction({
          name: "updateAdminConfig",
          data: { key: "onsiteProjectConfigs", value: item.projectConfigs || [], operator: getCurrentUser().name || "" }
        });
        const configResult = configRes.result || {};
        if (!configResult.ok) {
          wx.showToast({ title: TEXT.configWriteFail, icon: "none" });
          return false;
        }
      }
      const saveRes = await wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: { key: "onsiteConfigApprovals", value: nextRecords, operator: getCurrentUser().name || "" }
      });
      const saveResult = saveRes.result || {};
      if (!saveResult.ok) {
        wx.showToast({ title: TEXT.approvalSaveFail, icon: "none" });
        return false;
      }
      return true;
    } catch (error) {
      wx.showToast({ title: TEXT.cloudApprovalFail, icon: "none" });
      return false;
    }
  }
});
