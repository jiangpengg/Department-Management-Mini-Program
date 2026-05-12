const { buildTaskBoard, getStatusMeta, equipmentTemplates } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, canManageSystem } = require("../../utils/auth");
const { loadOrgConfig } = require("../../utils/org-store");
const { loadInstrumentCatalog } = require("../../utils/instrument-store");

const ATTENDANCE_LEVEL_KEY = "attendanceLevelOverrides";
const ONSITE_PROJECT_CONFIG_KEY = "onsiteProjectConfigs";

const DEFAULT_PROJECT_CONFIGS = [
  {
    key: "temperature",
    name: "测温类试验",
    equipment: [
      { instrumentId: "I001", name: "红外测温仪", quantity: 1, purpose: "设备温度核查" }
    ]
  },
  {
    key: "grounding",
    name: "接地类试验",
    equipment: [
      { instrumentId: "I003", name: "接地电阻测试仪", quantity: 1, purpose: "接地状态复核" }
    ]
  },
  {
    key: "discharge",
    name: "局放类试验",
    equipment: [
      { instrumentId: "I002", name: "局放检测仪", quantity: 1, purpose: "局放检测" }
    ]
  }
];

function decorate(list) {
  return list.map((item) => {
    const meta = getStatusMeta(item.status);
    return { ...item, statusText: meta.text, statusTone: meta.tone };
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTaskNoDate(value) {
  const normalized = normalizeDateValue(value) || formatDate(new Date());
  return normalized.replace(/-/g, "");
}

function parseDate(value) {
  const parts = String(value || formatDate(new Date())).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatShortDate(value) {
  const parts = String(value || "").split("-");
  if (parts.length < 3) return value || "";
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function formatShortDateRange(start, end) {
  const startText = formatShortDate(start);
  const endText = formatShortDate(end || start);
  return startText === endText ? startText : `${startText} 至 ${endText}`;
}

function normalizeDateValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
    if (!match) return "";
    return `${match[1]}-${pad(match[2])}-${pad(String(match[3]).replace("日", ""))}`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }
  return "";
}

function getRiskTone(value) {
  return Number(value) <= 3 ? "red" : "amber";
}

function isOutFlow(record = {}) {
  const type = String(record.type || "");
  return type === "出库申请" || type.indexOf("出库") >= 0 || type.indexOf("鍑哄簱") >= 0;
}

function isReturnFlow(record = {}) {
  const type = String(record.type || "");
  return type === "归还申请" || type.indexOf("归还") >= 0 || type.indexOf("褰掕繕") >= 0;
}

function isOutConfirmed(record = {}) {
  const status = String(record.status || "");
  return status === "已出库" || status.indexOf("已出库") >= 0 || status.indexOf("宸插嚭搴") >= 0;
}

function isReturnConfirmed(record = {}) {
  const status = String(record.status || "");
  return status === "已入库" || status.indexOf("已入库") >= 0 || status.indexOf("宸插叆搴") >= 0;
}

function normalizeConfigEquipment(list) {
  return (list || []).map((equipment) => ({
    ...equipment,
    quantity: Number(equipment.quantity) || 1
  }));
}

function formatConfigEquipmentLine(equipment = {}) {
  return `${equipment.name || "未命名仪器"} × ${Number(equipment.quantity) || 1}`;
}

function formatConfigEquipmentList(list = []) {
  return normalizeConfigEquipment(list).map(formatConfigEquipmentLine).join("、") || "未配置仪器";
}

function buildConfigChangeLines(actionType, previousProject = null, submittedProject = {}) {
  const projectName = submittedProject.name || (previousProject && previousProject.name) || "未命名试验项目";
  if (actionType === "add") {
    return [
      `新增项目：${projectName}`,
      `仪器清单：${formatConfigEquipmentList(submittedProject.equipment)}`
    ];
  }
  return [
    `修改项目：${projectName}`,
    `修改前：${formatConfigEquipmentList((previousProject || {}).equipment)}`,
    `修改后：${formatConfigEquipmentList(submittedProject.equipment)}`
  ];
}

function getOnsiteConfigActionType(record = {}) {
  if (record.actionType) return record.actionType;
  const title = record.title || "";
  if (title.indexOf("新增") >= 0) return "add";
  if (title.indexOf("修改") >= 0) return "edit";
  return "";
}

const onsiteStatusMeta = {
  waiting: { text: "待开始", tone: "amber", order: 2 },
  pending: { text: "待开始", tone: "amber", order: 2 },
  processing: { text: "进行中", tone: "blue", order: 1 },
  done: { text: "已结束", tone: "green", order: 3 }
};

function getOnsiteStatusMeta(status) {
  return onsiteStatusMeta[status] || onsiteStatusMeta.waiting;
}

function getWeekRange(offsetWeeks) {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1 + offsetWeeks * 7);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return { start: formatDate(monday), end: formatDate(nextMonday) };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: formatDate(start), end: formatDate(end) };
}

Page({
  data: {
    categories: [
      { key: "normal", name: "普通任务" },
      { key: "onsite", name: "现场工作" },
      { key: "emergency", name: "应急工作" },
      { key: "key", name: "重点工作" }
    ],
    activeCategory: "normal",
    onsiteOwnerFilters: [
      { key: "all", name: "全部" },
      { key: "mine", name: "我的" }
    ],
    onsiteOwnerFilter: "all",
    onsiteTimeFilters: [
      { key: "all", name: "全部" },
      { key: "history", name: "历史工作" },
      { key: "thisWeek", name: "本周" },
      { key: "nextWeek", name: "下周" },
      { key: "thisMonth", name: "本月" }
    ],
    onsiteTimeFilter: "all",
    onsiteTimeIndex: 0,
    board: {},
    tasks: [],
    summaries: [],
    createPanelVisible: false,
    onsiteSubmitting: false,
    editingTaskId: "",
    editingRecordId: "",
    isEditingTask: false,
    onsiteForm: {
      date: "",
      endDate: "",
      task: "",
      riskLevel: "1",
      attendance: [],
      attendanceText: "",
      owner: "",
      participants: [],
      participantsText: "",
      projectType: "temperature"
    },
    instruments: [],
    instrumentCatalog: [],
    canDeleteProjectConfig: false,
    canEditInstrumentConfig: false,
    activeEquipmentIndex: -1,
    equipmentSuggestions: [],
    riskLevels: ["1", "2", "3", "4", "5"],
    riskIndex: 0,
    projectConfigs: DEFAULT_PROJECT_CONFIGS,
    projectTypes: ["temperature", "grounding", "discharge"],
    projectTypeNames: ["测温类试验", "接地类试验", "局放类试验"],
    projectTypeIndex: 0,
    projectPanelVisible: false,
    projectSearch: "",
    filteredProjects: [],
    configPanelVisible: false,
    configMode: "edit",
    configProjectIndex: 0,
    configProjectName: "",
    configEquipmentList: [],
    configProjectPickerVisible: false,
    configProjectSearch: "",
    filteredConfigProjects: [],
    attendanceLevels: {},
    peopleNames: [],
    ownerSuggestions: [],
    ownerIndex: 0,
    personPanelVisible: false,
    personPanelType: "",
    personPanelTitle: "",
    personSearch: "",
    filteredPeople: [],
    tempSelectedPeople: [],
    tempSelectedPeopleText: "",
    calendarPanelVisible: false,
    calendarYear: 0,
    calendarMonth: 0,
    calendarTitle: "",
    calendarDays: [],
    calendarWeekdays: ["日", "一", "二", "三", "四", "五", "六"],
    tempStartDate: "",
    tempEndDate: "",
    rangePickingStep: "start"
  },

  async onLoad() {
    if (!ensureAuthorized()) return;
    this.orgConfig = await loadOrgConfig({ seed: false });
    const instrumentCatalog = await loadInstrumentCatalog({ operator: (getCurrentUser() || {}).name || "" });
    const canEditInstrumentConfig = await this.resolveInstrumentEditPermission();
    await this.loadProjectConfigs();
    const attendanceLevels = await this.loadAttendanceLevels();
    this.setData({
      attendanceLevels,
      peopleNames: (this.orgConfig.users || []).filter((item) => item.authorized).map((item) => item.name),
      instruments: instrumentCatalog,
      instrumentCatalog,
      canDeleteProjectConfig: canManageSystem(),
      canEditInstrumentConfig
    });
    this.loadBoard();
  },

  async resolveInstrumentEditPermission() {
    if (canManageSystem()) return true;
    if (!wx.cloud) return false;
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["compositeRoles"] }
      });
      const result = res.result || {};
      const roles = result.ok && result.configs ? (result.configs.compositeRoles || []) : [];
      const warehouse = roles.find((item) => item.key === "warehouse" || item.name === "仓库管理员") || {};
      return (warehouse.members || []).indexOf((getCurrentUser() || {}).name) >= 0;
    } catch (error) {
      return false;
    }
  },

  async loadAttendanceLevels() {
    const fallback = wx.getStorageSync(ATTENDANCE_LEVEL_KEY) || {};
    if (!wx.cloud) return fallback;
    try {
      const res = await wx.cloud.callFunction({
        name: "listAttendanceLevels"
      });
      const result = res.result || {};
      const levels = result.ok ? (result.levels || {}) : fallback;
      wx.setStorageSync(ATTENDANCE_LEVEL_KEY, levels);
      return levels;
    } catch (error) {
      return fallback;
    }
  },

  async loadProjectConfigs() {
    const fallback = wx.getStorageSync(ONSITE_PROJECT_CONFIG_KEY) || DEFAULT_PROJECT_CONFIGS;
    if (!wx.cloud) {
      this.applyProjectConfigs(fallback);
      return fallback;
    }
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: [ONSITE_PROJECT_CONFIG_KEY] }
      });
      const result = res.result || {};
      const remote = result.ok && result.configs ? result.configs[ONSITE_PROJECT_CONFIG_KEY] : null;
      const projectConfigs = remote || fallback;
      wx.setStorageSync(ONSITE_PROJECT_CONFIG_KEY, projectConfigs);
      if (!remote) {
        this.saveProjectConfigs(projectConfigs, 0);
      }
      this.applyProjectConfigs(projectConfigs);
      return projectConfigs;
    } catch (error) {
      this.applyProjectConfigs(fallback);
      return fallback;
    }
  },

  applyProjectConfigs(projectConfigs, selectedIndex = this.data.configProjectIndex || 0) {
    const normalized = projectConfigs.map((item, index) => ({
      key: item.key || `project-${Date.now()}-${index}`,
      name: item.name || "未命名试验项目",
      equipment: Array.isArray(item.equipment) ? item.equipment : []
    }));
    const configProjectIndex = Math.min(Math.max(selectedIndex, 0), Math.max(normalized.length - 1, 0));
    const selected = normalized[configProjectIndex] || { name: "", equipment: [] };
    this.setData({
      projectConfigs: normalized,
      projectTypes: normalized.map((item) => item.key),
      projectTypeNames: normalized.map((item) => item.name),
      configProjectIndex,
      configProjectName: selected.name,
      configEquipmentList: selected.equipment.map((item) => ({ ...item })),
      projectTypeIndex: Math.min(this.data.projectTypeIndex || 0, Math.max(normalized.length - 1, 0))
    });
  },

  async saveProjectConfigs(projectConfigs, selectedIndex) {
    wx.setStorageSync(ONSITE_PROJECT_CONFIG_KEY, projectConfigs);
    this.applyProjectConfigs(projectConfigs, selectedIndex);
    if (!wx.cloud) return true;
    try {
      const res = await wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: {
          key: ONSITE_PROJECT_CONFIG_KEY,
          value: projectConfigs,
          operator: (getApp().globalData.user || {}).name || ""
        }
      });
      const result = res.result || {};
      return Boolean(result.ok);
    } catch (error) {
      return false;
    }
  },

  getEquipmentTemplate(projectType) {
    const config = this.data.projectConfigs.find((item) => item.key === projectType);
    if (config) return config.equipment.map((item) => ({ ...item }));
    return (equipmentTemplates[projectType] || []).map((item) => ({ ...item }));
  },

  async loadBoard() {
    const user = getApp().globalData.user;
    const cloudOnsite = await this.loadCloudOnsiteWorks();
    const localOnsite = wx.cloud ? [] : (wx.getStorageSync("onsiteWorks") || []);
    const closedOnsiteTaskIds = wx.cloud ? [] : (wx.getStorageSync("closedOnsiteTaskIds") || []);
    const deletedOnsiteTaskIds = wx.cloud ? [] : (wx.getStorageSync("deletedOnsiteTaskIds") || []);
    const board = buildTaskBoard(user);
    board.onsite = this.mergeOnsite([], cloudOnsite.concat(localOnsite));
    board.onsite = board.onsite.filter((item) => deletedOnsiteTaskIds.indexOf(item.id) < 0);
    board.onsite = board.onsite.map((item) => (
      closedOnsiteTaskIds.indexOf(item.id) >= 0 ? { ...item, status: "done", progress: 100 } : item
    ));
    board.onsite = this.prepareOnsiteTasks(board.onsite);
    const summaries = this.data.categories.map((category) => {
      const list = board[category.key] || [];
      return {
        ...category,
        count: list.length
      };
    });
    this.setData({
      board,
      summaries,
      tasks: this.getVisibleTasks(board, this.data.activeCategory)
    });
  },

  async loadCloudOnsiteWorks() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listOnsiteWorks"
      });
      const result = res.result || {};
      return result.ok ? (result.records || []) : [];
    } catch (error) {
      return [];
    }
  },

  mergeOnsite(baseList, localList) {
    const byId = {};
    baseList.concat(localList).forEach((item) => {
      byId[item.id] = item;
    });
    return Object.keys(byId).map((id) => byId[id]);
  },

  prepareOnsiteTasks(list) {
    const user = getApp().globalData.user || {};
    return list.map((item) => {
      const normalizedStatus = item.status === "pending" ? "waiting" : item.status;
      const meta = getOnsiteStatusMeta(normalizedStatus);
      const capabilities = user.capabilities || [];
      const canOwnTask = item.owner === user.name || capabilities.includes("task_manage") || capabilities.includes("global_admin");
      return {
        ...item,
        taskNo: item.taskNo || item.no || "",
        status: normalizedStatus,
        statusText: meta.text,
        statusTone: meta.tone,
        statusOrder: meta.order,
        timeText: formatShortDateRange(item.date, item.endDate || item.deadline || item.date),
        riskTone: getRiskTone(item.riskLevel || item.priority),
        canStart: canOwnTask && normalizedStatus === "waiting",
        canFinish: canOwnTask && normalizedStatus === "processing"
      };
    }).sort((a, b) => {
      if (a.statusOrder !== b.statusOrder) return a.statusOrder - b.statusOrder;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
  },

  generateOnsiteTaskNo(date) {
    const day = formatTaskNoDate(date);
    const existing = (this.data.board.onsite || [])
      .map((item) => String(item.taskNo || item.no || ""))
      .filter((value) => value.indexOf(day) === 0)
      .map((value) => Number(value.slice(day.length)))
      .filter((value) => Number.isFinite(value));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return `${day}${pad(next)}`;
  },

  getVisibleTasks(board, categoryKey) {
    const list = board[categoryKey] || [];
    if (categoryKey !== "onsite") return decorate(list);
    return this.filterOnsiteTasks(list);
  },

  filterOnsiteTasks(list) {
    const user = getApp().globalData.user || {};
    const range = this.getOnsiteTimeRange(this.data.onsiteTimeFilter);
    return list.filter((item) => {
      if (item.status === "deleted" || item.visibleToAll === false) return false;
      if (this.data.onsiteOwnerFilter === "mine" && item.owner !== user.name) return false;
      if (!range) return true;
      const start = normalizeDateValue(item.date || item.deadline);
      const end = normalizeDateValue(item.endDate || item.deadline || item.date);
      if (!start) return true;
      return start < range.end && end >= range.start;
    });
  },

  getOnsiteTimeRange(key) {
    if (key === "thisWeek") return getWeekRange(0);
    if (key === "nextWeek") return getWeekRange(1);
    if (key === "thisMonth") return getMonthRange();
    return null;
  },

  async onShow() {
    const app = getApp();
    const targetCategory = app.globalData.taskCategory;
    if (targetCategory) {
      app.globalData.taskCategory = "";
      this.setData({ activeCategory: targetCategory });
    }
    if (this.getTabBar) {
      this.getTabBar().setData({ selected: 2, hidden: false });
    }
    await this.loadProjectConfigs();
    const attendanceLevels = await this.loadAttendanceLevels();
    this.setData({ attendanceLevels });
    this.loadBoard();
  },

  switchCategory(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      activeCategory: key,
      tasks: this.getVisibleTasks(this.data.board, key)
    });
  },

  switchOnsiteOwnerFilter(event) {
    this.setData({
      onsiteOwnerFilter: event.currentTarget.dataset.key
    }, () => {
      this.setData({
        tasks: this.getVisibleTasks(this.data.board, this.data.activeCategory)
      });
    });
  },

  switchOnsiteTimeFilter(event) {
    const index = event.detail && event.detail.value !== undefined
      ? Number(event.detail.value)
      : Math.max(0, this.data.onsiteTimeFilters.findIndex((item) => item.key === event.currentTarget.dataset.key));
    const target = this.data.onsiteTimeFilters[index] || this.data.onsiteTimeFilters[0];
    this.setData({
      onsiteTimeFilter: target.key,
      onsiteTimeIndex: index
    }, () => {
      this.setData({
        tasks: this.getVisibleTasks(this.data.board, this.data.activeCategory)
      });
    });
  },

  async openWorkConfigPanel() {
    const instrumentCatalog = await loadInstrumentCatalog({ operator: (getCurrentUser() || {}).name || "" });
    this.setData({
      configPanelVisible: true,
      configMode: "edit",
      instruments: instrumentCatalog,
      instrumentCatalog
    });
    this.applyProjectConfigs(this.data.projectConfigs, this.data.configProjectIndex || 0);
    this.setTabBarHidden(true);
  },

  closeWorkConfigPanel() {
    this.setData({
      configPanelVisible: false
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  selectConfigProject(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.applyProjectConfigs(this.data.projectConfigs, index);
  },

  openConfigProjectPicker() {
    this.setData({
      configProjectPickerVisible: true,
      configProjectSearch: "",
      filteredConfigProjects: this.buildConfigProjectOptions("")
    });
  },

  closeConfigProjectPicker() {
    this.setData({
      configProjectPickerVisible: false,
      configProjectSearch: ""
    });
  },

  onConfigProjectSearch(event) {
    const value = event.detail.value;
    this.setData({
      configProjectSearch: value,
      filteredConfigProjects: this.buildConfigProjectOptions(value)
    });
  },

  buildConfigProjectOptions(keyword) {
    const text = String(keyword || "").trim();
    return this.data.projectConfigs
      .map((item, index) => ({ ...item, index }))
      .filter((item) => !text || item.name.indexOf(text) >= 0);
  },

  confirmConfigProjectSelection(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.applyProjectConfigs(this.data.projectConfigs, index);
    this.closeConfigProjectPicker();
  },

  async switchConfigMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === "add") {
      const draft = await this.loadRejectedOnsiteConfigDraft();
      this.setData({
        configMode: "add",
        configProjectName: draft.name || "",
        configEquipmentList: draft.equipment || []
      });
      return;
    }
    this.setData({ configMode: "edit" });
    this.applyProjectConfigs(this.data.projectConfigs, this.data.configProjectIndex || 0);
  },

  onConfigProjectNameInput(event) {
    this.setData({ configProjectName: event.detail.value });
  },

  async saveCurrentProjectConfig() {
    const name = this.data.configMode === "edit"
      ? ((this.data.projectConfigs[this.data.configProjectIndex] || {}).name || "").trim()
      : this.data.configProjectName.trim();
    if (!name) {
      wx.showToast({ title: "请输入试验项目名称", icon: "none" });
      return;
    }
    if (this.data.configMode === "add") {
      const newProject = {
        key: `custom-${Date.now()}`,
        name,
        equipment: normalizeConfigEquipment(this.data.configEquipmentList)
      };
      const projectConfigs = this.data.projectConfigs.concat({
        ...newProject
      });
      await this.submitOnsiteConfigApproval(projectConfigs, "新增试验项目", {
        actionType: "add",
        projectKey: newProject.key,
        projectName: newProject.name,
        previousProject: null,
        submittedProject: newProject
      });
      return;
    }
    const index = this.data.configProjectIndex;
    const currentProject = this.data.projectConfigs[index] || {};
    const updatedProject = {
      ...currentProject,
      name,
      equipment: normalizeConfigEquipment(this.data.configEquipmentList)
    };
    const projectConfigs = this.data.projectConfigs.map((item, itemIndex) => (
      itemIndex === index
        ? updatedProject
        : item
    ));
    await this.submitOnsiteConfigApproval(projectConfigs, "修改试验项目仪器", {
      actionType: "edit",
      projectKey: updatedProject.key,
      projectName: updatedProject.name,
      previousProject: currentProject,
      submittedProject: updatedProject
    });
  },

  async submitOnsiteConfigApproval(projectConfigs, actionText, meta = {}) {
    if (!wx.cloud) {
      wx.showToast({ title: "云端不可用，无法提交确认", icon: "none" });
      return;
    }
    const user = getCurrentUser() || {};
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["onsiteConfigApprovals"] }
      });
      const result = res.result || {};
      const records = result.ok && result.configs ? (result.configs.onsiteConfigApprovals || []) : [];
      const nextRecords = records.filter((item) => !(
        item.source === "onsiteConfig"
        && item.applicant === (user.name || "")
        && getOnsiteConfigActionType(item) === meta.actionType
        && (meta.actionType === "add" || !item.projectKey || item.projectKey === meta.projectKey)
        && (item.status === "pending" || item.status === "rejected")
      ));
      const record = {
        id: `ONSITE-CONFIG-${Date.now()}`,
        source: "onsiteConfig",
        type: "现场试验配置",
        title: actionText,
        actionType: meta.actionType || this.data.configMode,
        projectKey: meta.projectKey || "",
        projectName: meta.projectName || "",
        applicant: user.name || "",
        applicantId: user.id || "",
        department: user.department || "",
        time: formatDate(new Date()),
        status: "pending",
        approvalRequired: true,
        detail: `${actionText}：${this.data.configMode === "edit" ? ((this.data.projectConfigs[this.data.configProjectIndex] || {}).name || "") : this.data.configProjectName}`,
        approvalFlow: [{ key: "instrument_admin", name: "仓库管理员确认", role: "仓库管理员" }],
        currentStepIndex: 0,
        previousProject: meta.previousProject || null,
        submittedProject: meta.submittedProject || null,
        changeLines: buildConfigChangeLines(
          meta.actionType || this.data.configMode,
          meta.previousProject || null,
          meta.submittedProject || {}
        ),
        projectConfigs
      };
      const saveRes = await wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: {
          key: "onsiteConfigApprovals",
          value: [record, ...nextRecords],
          operator: user.name || ""
        }
      });
      const saveResult = saveRes.result || {};
      wx.showToast({ title: saveResult.ok ? "已提交配置确认" : "提交失败", icon: saveResult.ok ? "success" : "none" });
      if (saveResult.ok) this.closeWorkConfigPanel();
    } catch (error) {
      wx.showToast({ title: "提交确认失败", icon: "none" });
    }
  },

  async loadRejectedOnsiteConfigDraft() {
    const empty = { name: "", equipment: [] };
    if (!wx.cloud) return empty;
    const user = getCurrentUser() || {};
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["onsiteConfigApprovals"] }
      });
      const result = res.result || {};
      const records = result.ok && result.configs ? (result.configs.onsiteConfigApprovals || []) : [];
      const draft = records.find((item) => (
        item.source === "onsiteConfig"
        && getOnsiteConfigActionType(item) === "add"
        && item.status === "rejected"
        && item.applicant === (user.name || "")
      ));
      if (!draft) return empty;
      const project = draft.submittedProject
        || ((draft.projectConfigs || []).find((item) => item.key === draft.projectKey) || {});
      return {
        name: project.name || draft.projectName || "",
        equipment: (project.equipment || []).map((item) => ({ ...item }))
      };
    } catch (error) {
      return empty;
    }
  },

  async deleteCurrentProjectConfig() {
    if (this.data.projectConfigs.length <= 1) {
      wx.showToast({ title: "至少保留一个试验项目", icon: "none" });
      return;
    }
    const index = this.data.configProjectIndex;
    const projectConfigs = this.data.projectConfigs.filter((_, itemIndex) => itemIndex !== index);
    const saved = await this.saveProjectConfigs(projectConfigs, Math.max(0, index - 1));
    wx.showToast({ title: saved ? "试验项目已删除" : "已本地删除，云端同步失败", icon: saved ? "success" : "none" });
  },

  addConfigEquipment() {
    const configEquipmentList = this.data.configEquipmentList.concat({
      instrumentId: `custom-instrument-${Date.now()}`,
      code: "",
      name: "",
      quantity: 1,
      purpose: ""
    });
    this.setData({ configEquipmentList });
  },

  onConfigEquipmentInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    const configEquipmentList = this.data.configEquipmentList.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    ));
    const nextData = { configEquipmentList };
    if (field === "name") {
      nextData.activeEquipmentIndex = index;
      nextData.equipmentSuggestions = this.buildEquipmentSuggestions(value);
    }
    this.setData(nextData);
  },

  buildEquipmentSuggestions(keyword) {
    const text = String(keyword || "").trim();
    if (!text) return [];
    const nameMap = {};
    (this.data.instrumentCatalog || [])
      .filter((item) => item.name && item.name.indexOf(text) >= 0)
      .forEach((item) => {
        if (!nameMap[item.name]) {
          nameMap[item.name] = { name: item.name };
        }
      });
    return Object.keys(nameMap).map((name) => nameMap[name]).slice(0, 8);
  },

  selectConfigEquipment(event) {
    if (!this.data.canEditInstrumentConfig) return;
    const index = Number(event.currentTarget.dataset.index);
    const name = event.currentTarget.dataset.name;
    if (!name) return;
    const configEquipmentList = this.data.configEquipmentList.map((item, itemIndex) => (
      itemIndex === index
        ? {
          ...item,
          instrumentId: "",
          code: "",
          model: "",
          name,
          quantity: item.quantity || 1
        }
        : item
    ));
    this.setData({
      configEquipmentList,
      activeEquipmentIndex: -1,
      equipmentSuggestions: []
    });
  },

  removeConfigEquipment(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      configEquipmentList: this.data.configEquipmentList.filter((_, itemIndex) => itemIndex !== index)
    });
  },

  createTask() {
    const current = this.data.categories.find((item) => item.key === this.data.activeCategory);
    if (this.data.activeCategory === "onsite") {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const defaultProjectType = this.data.projectTypes[0] || "temperature";
      this.setData({
        createPanelVisible: true,
        editingTaskId: "",
        editingRecordId: "",
        isEditingTask: false,
        onsiteForm: {
          date,
          endDate: date,
          task: "",
          riskLevel: "1",
          attendance: [],
          attendanceText: "",
          owner: getApp().globalData.user.name,
          participants: [],
          participantsText: "",
          projectType: defaultProjectType
        },
        riskIndex: 0,
        projectTypeIndex: 0,
        ownerIndex: Math.max(0, this.data.peopleNames.indexOf(getApp().globalData.user.name)),
        ownerSuggestions: []
      });
      this.setTabBarHidden(true);
      return;
    }
    wx.showToast({
      title: `后续接入${current ? current.name : "任务"}创建`,
      icon: "none"
    });
  },

  closeCreatePanel() {
    this.setData({
      createPanelVisible: false,
      editingTaskId: "",
      editingRecordId: "",
      isEditingTask: false
    });
    this.setTabBarHidden(false);
  },

  noop() {},

  setTabBarHidden(hidden) {
    if (this.getTabBar) {
      this.getTabBar().setData({ hidden });
    }
  },

  onOnsiteInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`onsiteForm.${field}`]: event.detail.value
    });
  },

  selectRiskLevel(event) {
    const value = event.currentTarget.dataset.value;
    this.setData({
      riskIndex: Math.max(0, this.data.riskLevels.indexOf(value)),
      "onsiteForm.riskLevel": value
    });
  },

  openProjectPanel() {
    this.setData({
      projectPanelVisible: true,
      projectSearch: "",
      filteredProjects: this.buildProjectOptions("")
    });
    this.setTabBarHidden(true);
  },

  openTaskDetail(event) {
    if (this.data.activeCategory !== "onsite") return;
    const id = event.currentTarget.dataset.id;
    const task = (this.data.board.onsite || []).find((item) => item.id === id);
    if (!task) return;
    const user = getApp().globalData.user || {};
    const canAdminEdit = (user.capabilities || []).includes("global_admin") || (user.capabilities || []).includes("task_manage");
    if (task.status === "done" && !canAdminEdit) {
      wx.showToast({ title: "已完成任务仅管理员可修改", icon: "none" });
      return;
    }
    const projectIndex = Math.max(0, this.data.projectTypes.indexOf(task.projectType || "temperature"));
    const attendance = this.splitPeople(task.attendance);
    const participants = this.splitPeople(task.participants);
    this.setData({
      createPanelVisible: true,
      editingTaskId: task.id,
      editingRecordId: task._id || "",
      isEditingTask: true,
      onsiteForm: {
        date: task.date || formatDate(new Date()),
        endDate: task.endDate || task.deadline || task.date || formatDate(new Date()),
        task: task.title,
        riskLevel: String(task.riskLevel || task.priority || "1"),
        attendance,
        attendanceText: attendance.join("、"),
        owner: task.owner || "",
        participants,
        participantsText: participants.join("、"),
        projectType: this.data.projectTypes[projectIndex] || task.projectType
      },
      riskIndex: Math.max(0, this.data.riskLevels.indexOf(String(task.riskLevel || task.priority || "1"))),
      projectTypeIndex: projectIndex,
      ownerSuggestions: []
    });
    this.setTabBarHidden(true);
  },

  splitPeople(value) {
    if (Array.isArray(value)) return value;
    return String(value || "").split("、").filter(Boolean);
  },

  closeProjectPanel() {
    this.setData({
      projectPanelVisible: false,
      projectSearch: ""
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  onProjectSearch(event) {
    const value = event.detail.value;
    this.setData({
      projectSearch: value,
      filteredProjects: this.buildProjectOptions(value)
    });
  },

  buildProjectOptions(keyword) {
    const text = String(keyword || "").trim();
    return this.data.projectTypeNames.map((name, index) => ({
      name,
      index,
      key: this.data.projectTypes[index]
    })).filter((item) => !text || item.name.indexOf(text) >= 0);
  },

  confirmProjectSelection(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      projectTypeIndex: index,
      "onsiteForm.projectType": this.data.projectTypes[index],
      projectPanelVisible: false,
      projectSearch: ""
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  onOwnerInput(event) {
    const value = event.detail.value;
    const keyword = value.trim();
    this.setData({
      "onsiteForm.owner": value,
      ownerSuggestions: keyword
        ? this.data.peopleNames.filter((name) => name.indexOf(keyword) >= 0).slice(0, 6)
        : []
    });
  },

  selectOwnerSuggestion(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      "onsiteForm.owner": name,
      ownerSuggestions: []
    });
  },

  openCalendarPanel() {
    const startDate = this.data.onsiteForm.date || formatDate(new Date());
    const endDate = this.data.onsiteForm.endDate || startDate;
    const date = parseDate(startDate);
    this.setData({
      calendarPanelVisible: true,
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth(),
      tempStartDate: startDate,
      tempEndDate: endDate,
      rangePickingStep: "start"
    }, this.buildCalendar);
    this.setTabBarHidden(true);
  },

  closeCalendarPanel() {
    this.setData({
      calendarPanelVisible: false
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  prevCalendarMonth() {
    const date = new Date(this.data.calendarYear, this.data.calendarMonth - 1, 1);
    this.setData({
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth()
    }, this.buildCalendar);
  },

  nextCalendarMonth() {
    const date = new Date(this.data.calendarYear, this.data.calendarMonth + 1, 1);
    this.setData({
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth()
    }, this.buildCalendar);
  },

  buildCalendar() {
    const year = this.data.calendarYear;
    const month = this.data.calendarMonth;
    const firstDay = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstDay.getDay());
    const startDate = this.data.tempStartDate;
    const endDate = this.data.tempEndDate;
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const value = formatDate(date);
      return {
        key: `${value}-${index}`,
        value,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        selectedStart: value === startDate,
        selectedEnd: value === endDate,
        inRange: startDate && endDate && value > startDate && value < endDate
      };
    });
    this.setData({
      calendarTitle: `${year}年${month + 1}月`,
      calendarDays: days
    });
  },

  selectCalendarDay(event) {
    const value = event.currentTarget.dataset.date;
    if (this.data.rangePickingStep === "start") {
      this.setData({
        tempStartDate: value,
        tempEndDate: value,
        rangePickingStep: "end"
      }, this.buildCalendar);
      return;
    }
    const startDate = this.data.tempStartDate;
    this.setData({
      tempStartDate: value < startDate ? value : startDate,
      tempEndDate: value < startDate ? startDate : value,
      rangePickingStep: "start"
    }, this.buildCalendar);
  },

  confirmCalendarRange() {
    this.setData({
      "onsiteForm.date": this.data.tempStartDate,
      "onsiteForm.endDate": this.data.tempEndDate,
      calendarPanelVisible: false
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  openAttendancePanel() {
    this.openPersonPanel("attendance");
  },

  openParticipantsPanel() {
    this.openPersonPanel("participants");
  },

  getPersonAttendanceLevel(name) {
    const person = ((this.orgConfig && this.orgConfig.users) || []).find((item) => item.name === name) || {};
    return this.data.attendanceLevels[person.id] || person.attendanceLevel || "";
  },

  buildPersonOptions(keyword, type) {
    const searchText = String(keyword || "").trim();
    return this.data.peopleNames
      .filter((name) => !searchText || name.indexOf(searchText) >= 0)
      .map((name) => {
        const level = this.getPersonAttendanceLevel(name);
        return {
          name,
          level
        };
      })
      .sort((a, b) => {
        if (type !== "attendance") return a.name.localeCompare(b.name, "zh-Hans-CN");
        const levelA = Number(a.level || 0);
        const levelB = Number(b.level || 0);
        if (levelA !== levelB) return levelB - levelA;
        return a.name.localeCompare(b.name, "zh-Hans-CN");
      });
  },

  openPersonPanel(type) {
    const selected = type === "attendance" ? this.data.onsiteForm.attendance : this.data.onsiteForm.participants;
    this.setData({
      personPanelVisible: true,
      personPanelType: type,
      personPanelTitle: type === "attendance" ? "选择到岗到位人员" : "选择参与人员",
      personSearch: "",
      tempSelectedPeople: selected.slice(),
      tempSelectedPeopleText: selected.join("、"),
      filteredPeople: this.buildPersonOptions("", type)
    });
    this.setTabBarHidden(true);
  },

  closePersonPanel() {
    this.setData({
      personPanelVisible: false,
      personSearch: "",
      tempSelectedPeople: [],
      tempSelectedPeopleText: ""
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  onPersonSearch(event) {
    const value = event.detail.value;
    const keyword = value.trim();
    this.setData({
      personSearch: value,
      filteredPeople: this.buildPersonOptions(keyword, this.data.personPanelType)
    });
  },

  toggleTempPerson(event) {
    const name = event.currentTarget.dataset.name;
    const selected = this.data.tempSelectedPeople.slice();
    const index = selected.indexOf(name);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(name);
    }
    this.setData({
      tempSelectedPeople: selected,
      tempSelectedPeopleText: selected.join("、")
    });
  },

  confirmPersonPanel() {
    const field = this.data.personPanelType === "attendance" ? "attendance" : "participants";
    const textField = this.data.personPanelType === "attendance" ? "attendanceText" : "participantsText";
    const selected = this.data.tempSelectedPeople.slice();
    this.setData({
      [`onsiteForm.${field}`]: selected,
      [`onsiteForm.${textField}`]: selected.join("、"),
      personPanelVisible: false,
      personSearch: "",
      tempSelectedPeople: [],
      tempSelectedPeopleText: ""
    });
    this.setTabBarHidden(this.data.createPanelVisible);
  },

  removeSelectedPerson(event) {
    const field = event.currentTarget.dataset.field;
    const name = event.currentTarget.dataset.name;
    const list = (this.data.onsiteForm[field] || []).filter((item) => item !== name);
    const textField = field === "attendance" ? "attendanceText" : "participantsText";
    this.setData({
      [`onsiteForm.${field}`]: list,
      [`onsiteForm.${textField}`]: list.join("、")
    });
  },

  async submitOnsiteWork() {
    const form = this.data.onsiteForm;
    if (!form.date || !form.endDate || !form.task || !form.owner) {
      wx.showToast({
        title: "请填写日期、任务和负责人",
        icon: "none"
      });
      return;
    }
    if (this.data.onsiteSubmitting) return;
    this.setData({ onsiteSubmitting: true });
    try {
      const user = getApp().globalData.user;
      const originalTask = this.data.isEditingTask
        ? (this.data.board.onsite || []).find((task) => task.id === this.data.editingTaskId)
        : null;
      const taskNo = originalTask && originalTask.taskNo ? originalTask.taskNo : this.generateOnsiteTaskNo(form.date);
      const item = {
        id: this.data.editingTaskId || `ONSITE-${Date.now()}`,
        taskNo,
        title: form.task,
        owner: form.owner,
        department: user.department,
        date: form.date,
        endDate: form.endDate,
        deadline: form.endDate,
        status: originalTask ? originalTask.status : "waiting",
        statusText: originalTask ? originalTask.statusText : "待开始",
        statusTone: originalTask ? originalTask.statusTone : "amber",
        priority: form.riskLevel,
        progress: originalTask ? originalTask.progress : 0,
        riskLevel: form.riskLevel,
        attendance: form.attendance.join("、"),
        participants: form.participants.join("、"),
        projectType: form.projectType,
        equipmentDetails: this.getEquipmentTemplate(form.projectType)
      };
      if (this.data.isEditingTask) {
        await this.saveEditedOnsiteWork(item);
        return;
      }
      const cloudId = await this.createCloudOnsiteWork(item);
      const savedItem = cloudId ? { ...item, _id: cloudId } : item;
      const onsite = this.prepareOnsiteTasks([savedItem, ...(this.data.board.onsite || [])]);
      const board = {
        ...this.data.board,
        onsite
      };
      const summaries = this.data.summaries.map((summary) => (
        summary.key === "onsite" ? { ...summary, count: onsite.length } : summary
      ));
      this.setData({
        board,
        summaries,
        tasks: this.data.activeCategory === "onsite" ? this.getVisibleTasks(board, "onsite") : this.data.tasks,
        createPanelVisible: false
      });
      this.setTabBarHidden(false);
      if (!cloudId) {
        wx.setStorageSync("onsiteWorks", onsite.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
      }
      wx.showToast({
        title: cloudId ? "现场工作已同步" : "现场工作已本地暂存",
        icon: "success"
      });
    } finally {
      this.setData({ onsiteSubmitting: false });
    }
  },

  async saveEditedOnsiteWork(item) {
    const recordId = this.data.editingRecordId;
    const original = (this.data.board.onsite || []).find((task) => task.id === item.id) || {};
    const user = getApp().globalData.user || {};
    const canAdminEdit = (user.capabilities || []).includes("global_admin") || (user.capabilities || []).includes("task_manage");
    if (original.status === "done" && !canAdminEdit) {
      wx.showToast({ title: "已完成任务仅管理员可修改", icon: "none" });
      return;
    }
    const editedItem = {
      ...item,
      status: original.status || item.status,
      statusText: original.statusText || item.statusText,
      statusTone: original.statusTone || item.statusTone,
      statusOrder: original.statusOrder,
      progress: original.progress !== undefined ? original.progress : item.progress
    };
    const onsite = this.prepareOnsiteTasks((this.data.board.onsite || []).map((task) => (
      task.id === item.id ? { ...task, ...editedItem, _id: task._id } : task
    )));
    const board = { ...this.data.board, onsite };
    this.setData({
      board,
      tasks: this.getVisibleTasks(board, "onsite"),
      createPanelVisible: false,
      editingTaskId: "",
      editingRecordId: "",
      isEditingTask: false
    });
    this.setTabBarHidden(false);
    if (recordId) {
      await this.updateCloudOnsiteWork(recordId, editedItem);
    } else {
      wx.setStorageSync("onsiteWorks", onsite.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
    }
    wx.showToast({ title: "任务已更新", icon: "success" });
  },

  async createCloudOnsiteWork(item) {
    if (!wx.cloud) return "";
    try {
      const res = await wx.cloud.callFunction({
        name: "createOnsiteWork",
        data: {
          user: getApp().globalData.user,
          work: item
        }
      });
      const result = res.result || {};
      return result.ok ? result.recordId : "";
    } catch (error) {
      return "";
    }
  },

  async finishTask(event) {
    const taskId = event.currentTarget.dataset.id;
    if (this.data.activeCategory === "onsite") {
      const targetTask = (this.data.board.onsite || []).find((item) => item.id === taskId) || {};
      const needsInstrumentCycle = targetTask.equipmentDetails && targetTask.equipmentDetails.length;
      const incompleteInstrumentCycle = needsInstrumentCycle ? await this.hasIncompleteInstrumentCycle(taskId) : false;
      if (incompleteInstrumentCycle) {
        wx.showToast({
          title: "请先完成仪器归还",
          icon: "none"
        });
        return;
      }
    }
    const nextList = (this.data.board[this.data.activeCategory] || []).map((item) => {
      if (item.id !== taskId) return item;
      const meta = getStatusMeta("done");
      return { ...item, status: "done", progress: 100, statusText: meta.text, statusTone: meta.tone };
    });
    const finalList = this.data.activeCategory === "onsite" ? this.prepareOnsiteTasks(nextList) : nextList;
    const board = {
      ...this.data.board,
      [this.data.activeCategory]: finalList
    };
    this.setData({ board, tasks: this.getVisibleTasks(board, this.data.activeCategory) });
    const target = finalList.find((item) => item.id === taskId);
    if (target && target._id) {
      await this.updateCloudOnsiteWork(target._id, { status: "done", progress: 100 });
      return;
    }
    if (this.data.activeCategory === "onsite") {
      wx.setStorageSync("onsiteWorks", nextList.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
      const closedTaskIds = wx.getStorageSync("closedOnsiteTaskIds") || [];
      if (closedTaskIds.indexOf(taskId) < 0) {
        wx.setStorageSync("closedOnsiteTaskIds", [taskId, ...closedTaskIds]);
      }
    }
  },

  async hasUnreturnedInstruments(taskId) {
    return this.hasIncompleteInstrumentCycle(taskId);
  },

  async hasIncompleteInstrumentCycle(taskId) {
    const flows = await this.loadInstrumentFlows();
    const outRecords = flows.filter((item) => item.taskId === taskId && isOutFlow(item) && isOutConfirmed(item));
    if (!outRecords.length) return true;
    const returnedKeys = flows
      .filter((item) => item.taskId === taskId && isReturnFlow(item) && isReturnConfirmed(item))
      .flatMap((item) => (item.equipmentDetails || []).map((equipment) => equipment.code || equipment.instrumentId || equipment.name));
    return outRecords.some((record) => (record.equipmentDetails || []).some((equipment) => (
      returnedKeys.indexOf(equipment.code || equipment.instrumentId || equipment.name) < 0
    )));
  },

  async loadInstrumentFlows() {
    if (!wx.cloud) return wx.getStorageSync("instrumentFlow") || [];
    try {
      const res = await wx.cloud.callFunction({ name: "listInstrumentFlows" });
      const result = res.result || {};
      return result.ok ? (result.records || []) : (wx.getStorageSync("instrumentFlow") || []);
    } catch (error) {
      return wx.getStorageSync("instrumentFlow") || [];
    }
  },

  async deleteEditingTask() {
    if (!this.data.editingTaskId) return;
    const taskId = this.data.editingTaskId;
    const recordId = this.data.editingRecordId;
    wx.showModal({
      title: "删除现场工作",
      content: "确定删除这个现场工作吗？",
      confirmText: "删除",
      confirmColor: "#b42318",
      success: async (res) => {
        if (!res.confirm) return;
        const onsite = (this.data.board.onsite || []).filter((item) => item.id !== taskId);
        const board = { ...this.data.board, onsite };
        this.setData({
          board,
          tasks: this.getVisibleTasks(board, "onsite"),
          createPanelVisible: false,
          editingTaskId: "",
          editingRecordId: "",
          isEditingTask: false
        });
        this.setTabBarHidden(false);
        if (recordId) {
          await this.updateCloudOnsiteWork(recordId, {
            status: "deleted",
            visibleToAll: false
          });
        } else {
          wx.setStorageSync("onsiteWorks", onsite.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
          const deletedIds = wx.getStorageSync("deletedOnsiteTaskIds") || [];
          if (deletedIds.indexOf(taskId) < 0) {
            wx.setStorageSync("deletedOnsiteTaskIds", [taskId, ...deletedIds]);
          }
        }
        wx.showToast({ title: "任务已删除", icon: "success" });
      }
    });
  },

  async updateCloudOnsiteWork(recordId, data) {
    if (!wx.cloud || !recordId) return false;
    try {
      const res = await wx.cloud.callFunction({
        name: "updateOnsiteWork",
        data: {
          recordId,
          data
        }
      });
      const result = res.result || {};
      return Boolean(result.ok);
    } catch (error) {
      return false;
    }
  },

  async openStartTask(event) {
    const taskId = event.currentTarget.dataset.id;
    await this.startTask(taskId);
  },

  async startTask(taskId) {
    const update = (item) => item.id === taskId
      ? { ...item, status: "processing", progress: Math.max(item.progress || 0, 10) }
      : item;
    const onsite = this.prepareOnsiteTasks((this.data.board.onsite || []).map(update));
    const board = { ...this.data.board, onsite };
    this.setData({
      board,
      tasks: this.data.activeCategory === "onsite" ? this.getVisibleTasks(board, "onsite") : this.data.tasks
    });
    const target = onsite.find((item) => item.id === taskId);
    if (target && target._id) {
      await this.updateCloudOnsiteWork(target._id, {
        status: "processing",
        progress: target.progress
      });
    } else {
      wx.setStorageSync("onsiteWorks", onsite.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
    }
    wx.showToast({ title: "任务已启动", icon: "success" });
  }
});
