const { buildTaskBoard, getStatusMeta, instruments, users, equipmentTemplates } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

const ATTENDANCE_LEVEL_KEY = "attendanceLevelOverrides";

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

function parseDate(value) {
  const parts = String(value || formatDate(new Date())).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
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
      { key: "thisWeek", name: "本周" },
      { key: "nextWeek", name: "下周" },
      { key: "thisMonth", name: "本月" }
    ],
    onsiteTimeFilter: "thisWeek",
    board: {},
    tasks: [],
    summaries: [],
    createPanelVisible: false,
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
    instruments,
    riskLevels: ["1", "2", "3", "4", "5"],
    riskIndex: 0,
    projectTypes: ["temperature", "grounding", "discharge"],
    projectTypeNames: ["测温类试验", "接地类试验", "局放类试验"],
    projectTypeIndex: 0,
    projectPanelVisible: false,
    projectSearch: "",
    filteredProjects: [],
    attendanceLevels: {},
    peopleNames: users.filter((item) => item.authorized).map((item) => item.name),
    ownerSuggestions: [],
    ownerIndex: 0,
    startPanelVisible: false,
    startTaskId: "",
    startAttendance: [],
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
    const attendanceLevels = await this.loadAttendanceLevels();
    this.setData({ attendanceLevels });
    this.loadBoard();
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

  async loadBoard() {
    const user = getApp().globalData.user;
    const cloudOnsite = await this.loadCloudOnsiteWorks();
    const localOnsite = cloudOnsite.length ? [] : (wx.getStorageSync("onsiteWorks") || []);
    const closedOnsiteTaskIds = cloudOnsite.length ? [] : (wx.getStorageSync("closedOnsiteTaskIds") || []);
    const deletedOnsiteTaskIds = wx.getStorageSync("deletedOnsiteTaskIds") || [];
    const board = buildTaskBoard(user);
    board.onsite = this.mergeOnsite(board.onsite || [], cloudOnsite.concat(localOnsite));
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
      const canOwnTask = item.owner === user.name;
      return {
        ...item,
        status: normalizedStatus,
        statusText: meta.text,
        statusTone: meta.tone,
        statusOrder: meta.order,
        timeText: item.date === item.endDate ? item.date : `${item.date} 至 ${item.endDate || item.deadline || item.date}`,
        canStart: canOwnTask && normalizedStatus === "waiting",
        canFinish: canOwnTask && normalizedStatus === "processing"
      };
    }).sort((a, b) => {
      if (a.statusOrder !== b.statusOrder) return a.statusOrder - b.statusOrder;
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
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
      const start = item.date || item.deadline;
      const end = item.endDate || item.deadline || start;
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
    if (this.getTabBar) {
      this.getTabBar().setData({ selected: 2, hidden: false });
    }
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
    this.setData({
      onsiteTimeFilter: event.currentTarget.dataset.key
    }, () => {
      this.setData({
        tasks: this.getVisibleTasks(this.data.board, this.data.activeCategory)
      });
    });
  },

  createTask() {
    const current = this.data.categories.find((item) => item.key === this.data.activeCategory);
    if (this.data.activeCategory === "onsite") {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
          projectType: "temperature"
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
        projectType: task.projectType || this.data.projectTypes[projectIndex]
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
  },

  openAttendancePanel() {
    this.openPersonPanel("attendance");
  },

  openParticipantsPanel() {
    this.openPersonPanel("participants");
  },

  getPersonAttendanceLevel(name) {
    const person = users.find((item) => item.name === name) || {};
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
          level,
          levelText: level ? `到岗${level}级` : "未配置"
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
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
    this.setTabBarHidden(this.data.createPanelVisible || this.data.startPanelVisible);
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
    const user = getApp().globalData.user;
    const item = {
      id: this.data.editingTaskId || `ONSITE-${Date.now()}`,
      title: form.task,
      owner: form.owner,
      department: user.department,
      date: form.date,
      endDate: form.endDate,
      deadline: form.endDate,
      status: "waiting",
      statusText: "待开始",
      statusTone: "amber",
      priority: form.riskLevel,
      progress: 0,
      riskLevel: form.riskLevel,
      attendance: form.attendance.join("、"),
      participants: form.participants.join("、"),
      projectType: form.projectType,
      equipmentDetails: equipmentTemplates[form.projectType] || []
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
  },

  async saveEditedOnsiteWork(item) {
    const recordId = this.data.editingRecordId;
    const onsite = this.prepareOnsiteTasks((this.data.board.onsite || []).map((task) => (
      task.id === item.id ? { ...task, ...item, _id: task._id } : task
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
      await this.updateCloudOnsiteWork(recordId, item);
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
      const hasUnreturned = await this.hasUnreturnedInstruments(taskId);
      if (hasUnreturned) {
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
    const flows = await this.loadInstrumentFlows();
    const outRecords = flows.filter((item) => item.taskId === taskId && item.type === "出库申请" && item.status === "已出库");
    if (!outRecords.length) return false;
    const returnedKeys = flows
      .filter((item) => item.taskId === taskId && item.type === "归还申请" && item.status === "已入库")
      .map((item) => item.instrumentName)
      .join("|");
    return outRecords.some((item) => returnedKeys.indexOf(item.instrumentName) < 0);
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

  openStartTask(event) {
    const id = event.currentTarget.dataset.id;
    const task = this.data.tasks.find((item) => item.id === id);
    this.setData({
      startPanelVisible: true,
      startTaskId: id,
      startAttendance: task && task.attendance ? task.attendance.split("、").filter(Boolean) : []
    });
    this.setTabBarHidden(true);
  },

  closeStartPanel() {
    this.setData({
      startPanelVisible: false,
      startTaskId: "",
      startAttendance: []
    });
    this.setTabBarHidden(false);
  },

  onStartAttendanceChange(event) {
    this.setData({
      startAttendance: event.detail.value
    });
  },

  async confirmStartTask() {
    if (!this.data.startAttendance.length) {
      wx.showToast({ title: "请选择到岗到位人员", icon: "none" });
      return;
    }
    const taskId = this.data.startTaskId;
    const attendance = this.data.startAttendance.join("、");
    const update = (item) => item.id === taskId
      ? { ...item, status: "processing", progress: Math.max(item.progress || 0, 10), attendance }
      : item;
    const onsite = this.prepareOnsiteTasks((this.data.board.onsite || []).map(update));
    const board = { ...this.data.board, onsite };
    this.setData({
      board,
      tasks: this.data.activeCategory === "onsite" ? this.getVisibleTasks(board, "onsite") : this.data.tasks,
      startPanelVisible: false,
      startTaskId: "",
      startAttendance: []
    });
    this.setTabBarHidden(false);
    const target = onsite.find((item) => item.id === taskId);
    if (target && target._id) {
      await this.updateCloudOnsiteWork(target._id, {
        status: "processing",
        progress: target.progress,
        attendance
      });
    } else {
      wx.setStorageSync("onsiteWorks", onsite.filter((work) => String(work.id).indexOf("ONSITE-") === 0));
    }
    wx.showToast({ title: "任务已启动", icon: "success" });
    wx.showModal({
      title: "提醒说明",
      content: "后续接入订阅消息后，可在任务开始前一周向到岗到位人员推送微信提醒。",
      showCancel: false
    });
  }
});
