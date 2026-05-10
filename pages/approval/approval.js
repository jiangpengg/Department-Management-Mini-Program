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
  return `${equipment.name || TEXT.instrumentDetail}${meta ? ` (${meta})` : ""} \u00d7 ${Number(equipment.quantity) || 1}`;
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
    await this.loadApprovalRoleMembers();
    const cloudSealApplications = await this.loadCloudSealApplications();
    const cloudInstrumentApplications = await this.loadCloudInstrumentApplications();
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

  async loadCloudInstrumentApplications() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({ name: "listInstrumentFlows" });
      const result = res.result || {};
      if (!result.ok) return [];
      return (result.records || [])
        .filter((item) => item.approvalRequired || item.approvalStatus || item.status === STATUS.waitApproval || item.status === STATUS.waitConfirm)
        .map((item) => this.convertInstrumentFlowToApplication(item));
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

  convertInstrumentFlowToApplication(record) {
    const isReturn = record.type === STATUS.back;
    const isPendingApproval = record.approvalStatus === "pending" || record.status === STATUS.waitApproval;
    const needsInventoryConfirm = record.status === STATUS.waitConfirm || record.approvalStatus === "approved";
    const isClosed = record.status === STATUS.outDone || record.status === STATUS.inDone || record.approvalStatus === "completed";
    const status = record.approvalStatus === "rejected" ? "rejected" : (isClosed ? "approved" : "pending");
    const equipmentLines = (record.equipmentDetails || []).map(formatEquipmentLine);
    const equipmentText = record.instrumentName || equipmentLines.join("\u3001");
    const approvalFlow = needsInventoryConfirm
      ? [{ key: "instrument_confirm", name: isReturn ? "\u4ed3\u5e93\u7ba1\u7406\u5458\u786e\u8ba4\u5165\u5e93" : "\u4ed3\u5e93\u7ba1\u7406\u5458\u786e\u8ba4\u51fa\u5e93", role: TEXT.warehouse }]
      : [{ key: "instrument_admin", name: `${TEXT.instrumentAdmin}\u5ba1\u6279`, role: TEXT.instrumentAdmin }];
    return {
      ...record,
      source: "instrument",
      type: isReturn ? TEXT.instrumentReturn : TEXT.instrumentBorrow,
      title: record.taskTitle || record.purpose || (isReturn ? TEXT.returnTitle : TEXT.borrowTitle),
      applicant: record.applicant || record.borrower || "",
      department: record.department || "",
      time: record.time || "",
      status,
      approvalRequired: true,
      needsInventoryConfirm: needsInventoryConfirm && !isClosed,
      approveText: needsInventoryConfirm ? (isReturn ? TEXT.confirmIn : TEXT.confirmOut) : TEXT.pass,
      detail: `\u5173\u8054\u73b0\u573a\u5de5\u4f5c\uff1a${record.taskTitle || record.purpose || TEXT.unlinked}`,
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
    return {
      ...item,
      currentStepText: item.status === "pending" && currentStep ? currentStep.name : "",
      canReview: this.canReviewStep(item, currentStep)
    };
  },

  canReviewStep(item, currentStep) {
    if (item.status !== "pending" || !currentStep) return false;
    const user = getCurrentUser();
    if (currentStep.key === "section") return user.roleKey === "section_manager" && user.department === item.department;
    if (currentStep.key === "institute") return canManageSystem();
    if (currentStep.key === "instrument_admin" || currentStep.key === "instrument_confirm") {
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
      const isReturn = item.type === TEXT.instrumentReturn;
      const data = item.needsInventoryConfirm
        ? {
          approvalStatus: "completed",
          status: isReturn ? STATUS.inDone : STATUS.outDone,
          confirmedBy: getCurrentUser().name
        }
        : {
          approvalStatus: approved ? "approved" : "rejected",
          status: approved ? STATUS.waitConfirm : STATUS.rejected,
          currentStepIndex: 0,
          approvedBy: approved ? getCurrentUser().name : "",
          rejectedBy: approved ? "" : getCurrentUser().name
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
