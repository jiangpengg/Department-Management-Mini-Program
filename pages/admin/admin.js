const { departments, users, approvalFlows, meetingRooms } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, canManageSystem, canManageDepartment, getManageScope } = require("../../utils/auth");

const ATTENDANCE_LEVEL_KEY = "attendanceLevelOverrides";
const RISK_CONFIG_KEY = "riskLevelPeopleConfig";
const ROLE_CONFIG_KEY = "compositeRoleConfig";

const riskLevels = ["1", "2", "3", "4", "5"];
const defaultRoles = [
  { key: "warehouse", name: "仓库管理员", members: [] },
  { key: "plan", name: "计划专员", members: [] },
  { key: "technology", name: "科技专员", members: [] },
  { key: "publicity", name: "宣传专员", members: [] },
  { key: "safety", name: "安全员", members: [] }
];

function uniq(list) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

Page({
  data: {
    departments: [],
    users: [],
    peopleNames: [],
    riskPickerOptions: riskLevels.map((level) => ({ level, name: `${level}级风险` })),
    activeRiskIndex: 0,
    activeRiskName: "1级风险",
    riskLevelConfigs: [],
    riskDraftMembers: [],
    riskSearchText: "",
    riskSuggestions: [],
    activeRoleIndex: 0,
    activeRoleName: "",
    compositeRoles: [],
    roleDraftMembers: [],
    roleSearchText: "",
    roleSuggestions: [],
    newRoleName: "",
    meetingRooms: [],
    roomForm: {
      name: "",
      capacity: "",
      features: ""
    },
    roomSubmitting: false,
    approvalFlows,
    scope: "self",
    canGlobalManage: false
  },

  async onLoad() {
    if (!ensureAuthorized()) return;
    if (!canManageDepartment()) {
      wx.showToast({ title: "无管理配置权限", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    const scope = getManageScope();
    const currentUser = getCurrentUser();
    const visibleUsers = scope === "global"
      ? users
      : users.filter((item) => item.department === currentUser.department);
    const visibleDepartments = scope === "global"
      ? departments
      : departments.filter((item) => item.name === currentUser.department);
    const peopleNames = visibleUsers.filter((item) => item.authorized).map((item) => item.name);
    const attendanceLevels = await this.loadAttendanceLevels();
    const riskLevelConfigs = await this.loadRiskLevelConfigs(attendanceLevels, peopleNames);
    const compositeRoles = await this.loadCompositeRoles();

    this.setData({
      scope,
      canGlobalManage: canManageSystem(),
      departments: this.decorateDepartments(visibleDepartments, users),
      users: this.decorateUsers(visibleUsers),
      peopleNames,
      riskLevelConfigs,
      riskDraftMembers: riskLevelConfigs[0] ? riskLevelConfigs[0].members.slice() : [],
      compositeRoles,
      activeRoleName: compositeRoles[0] ? compositeRoles[0].name : "",
      roleDraftMembers: compositeRoles[0] ? compositeRoles[0].members.slice() : [],
      approvalFlows: approvalFlows.filter((item) => item.approvalRequired)
    });
    if (canManageSystem()) {
      this.loadMeetingRooms();
    }
  },

  decorateDepartments(departmentList, userList) {
    return departmentList.map((department) => ({
      ...department,
      memberCount: userList.filter((user) => user.department === department.name && user.authorized).length
    }));
  },

  decorateUsers(userList) {
    return userList.map((item) => ({
      ...item,
      reviewerForText: item.reviewerFor.join("、")
    }));
  },

  async loadAttendanceLevels() {
    const fallback = wx.getStorageSync(ATTENDANCE_LEVEL_KEY) || {};
    if (!wx.cloud) return fallback;
    try {
      const res = await wx.cloud.callFunction({ name: "listAttendanceLevels" });
      const result = res.result || {};
      const levels = result.ok ? (result.levels || {}) : fallback;
      wx.setStorageSync(ATTENDANCE_LEVEL_KEY, levels);
      return levels;
    } catch (error) {
      return fallback;
    }
  },

  async loadRiskLevelConfigs(attendanceLevels, allowedNames) {
    const cached = wx.getStorageSync(RISK_CONFIG_KEY);
    if (cached && cached.length) {
      return this.normalizeRiskConfig(cached, allowedNames);
    }
    const byLevel = riskLevels.map((level) => ({
      level,
      members: []
    }));
    Object.keys(attendanceLevels || {}).forEach((userId) => {
      const person = users.find((item) => item.id === userId);
      const level = attendanceLevels[userId];
      const target = byLevel.find((item) => item.level === String(level));
      if (person && target && allowedNames.indexOf(person.name) >= 0) {
        target.members.push(person.name);
      }
    });
    return this.normalizeRiskConfig(byLevel, allowedNames);
  },

  normalizeRiskConfig(configs, allowedNames = this.data.peopleNames) {
    return riskLevels.map((level) => {
      const found = (configs || []).find((item) => String(item.level) === level) || {};
      return {
        level,
        members: uniq(found.members).filter((name) => allowedNames.indexOf(name) >= 0)
      };
    });
  },

  async loadCompositeRoles() {
    const fallback = wx.getStorageSync(ROLE_CONFIG_KEY) || defaultRoles;
    if (!wx.cloud) return this.normalizeRoles(fallback);
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: ["compositeRoles"] }
      });
      const result = res.result || {};
      const roles = result.ok && result.configs && result.configs.compositeRoles
        ? result.configs.compositeRoles
        : fallback;
      wx.setStorageSync(ROLE_CONFIG_KEY, roles);
      return this.normalizeRoles(roles);
    } catch (error) {
      return this.normalizeRoles(fallback);
    }
  },

  normalizeRoles(roles) {
    const byKey = {};
    defaultRoles.concat(roles || []).forEach((role) => {
      byKey[role.key] = {
        key: role.key,
        name: role.name,
        members: uniq(role.members)
      };
    });
    return Object.keys(byKey).map((key) => byKey[key]);
  },

  buildSuggestions(keyword, selected) {
    const text = String(keyword || "").trim();
    if (!text) return [];
    return this.data.peopleNames
      .filter((name) => name.indexOf(text) >= 0 && (selected || []).indexOf(name) < 0)
      .slice(0, 8);
  },

  selectRiskLevelConfig(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const config = this.data.riskLevelConfigs[index] || { members: [] };
    this.setData({
      activeRiskIndex: index,
      activeRiskName: this.data.riskPickerOptions[index] ? this.data.riskPickerOptions[index].name : "",
      riskDraftMembers: config.members.slice(),
      riskSearchText: "",
      riskSuggestions: []
    });
  },

  onRiskSearch(event) {
    const value = event.detail.value;
    this.setData({
      riskSearchText: value,
      riskSuggestions: this.buildSuggestions(value, this.data.riskDraftMembers)
    });
  },

  addRiskMember(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      riskDraftMembers: uniq(this.data.riskDraftMembers.concat(name)),
      riskSearchText: "",
      riskSuggestions: []
    });
  },

  removeRiskMember(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      riskDraftMembers: this.data.riskDraftMembers.filter((member) => member !== name)
    });
  },

  confirmRiskConfig() {
    const active = this.data.riskLevelConfigs[this.data.activeRiskIndex];
    if (!active) return;
    const riskLevelConfigs = this.data.riskLevelConfigs.map((item) => (
      item.level === active.level ? { ...item, members: this.data.riskDraftMembers.slice() } : item
    ));
    this.setData({ riskLevelConfigs }, this.saveRiskLevelConfigs);
  },

  saveRiskLevelConfigs() {
    wx.setStorageSync(RISK_CONFIG_KEY, this.data.riskLevelConfigs);
    const levelMap = {};
    this.data.riskLevelConfigs.forEach((config) => {
      config.members.forEach((name) => {
        const person = users.find((item) => item.name === name);
        if (person) levelMap[person.id] = config.level;
      });
    });
    wx.setStorageSync(ATTENDANCE_LEVEL_KEY, levelMap);

    if (wx.cloud) {
      wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: {
          key: "riskLevelPeople",
          value: this.data.riskLevelConfigs,
          operator: (getCurrentUser() || {}).name || ""
        }
      }).catch(() => {});
      this.data.peopleNames.forEach((name) => {
        const person = users.find((item) => item.name === name) || {};
        if (!person.id) return;
        wx.cloud.callFunction({
          name: "updateAttendanceLevel",
          data: {
            userId: person.id,
            level: levelMap[person.id] || "",
            userName: person.name || "",
            department: person.department || "",
            operator: (getCurrentUser() || {}).name || ""
          }
        }).catch(() => {});
      });
    }
    wx.showToast({ title: "风险等级人员已保存", icon: "none" });
  },

  selectRoleConfig(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const role = this.data.compositeRoles[index] || { members: [] };
    this.setData({
      activeRoleIndex: index,
      activeRoleName: role.name || "",
      roleDraftMembers: role.members.slice(),
      roleSearchText: "",
      roleSuggestions: []
    });
  },

  onRoleSearch(event) {
    const value = event.detail.value;
    this.setData({
      roleSearchText: value,
      roleSuggestions: this.buildSuggestions(value, this.data.roleDraftMembers)
    });
  },

  addRoleMember(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      roleDraftMembers: uniq(this.data.roleDraftMembers.concat(name)),
      roleSearchText: "",
      roleSuggestions: []
    });
  },

  removeRoleMember(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({
      roleDraftMembers: this.data.roleDraftMembers.filter((member) => member !== name)
    });
  },

  onNewRoleInput(event) {
    this.setData({ newRoleName: event.detail.value });
  },

  addCompositeRole() {
    const name = this.data.newRoleName.trim();
    if (!name) {
      wx.showToast({ title: "请输入角色名称", icon: "none" });
      return;
    }
    const key = `custom_${Date.now()}`;
    const compositeRoles = this.data.compositeRoles.concat({ key, name, members: [] });
    this.setData({
      compositeRoles,
      activeRoleIndex: compositeRoles.length - 1,
      activeRoleName: name,
      roleDraftMembers: [],
      roleSearchText: "",
      roleSuggestions: [],
      newRoleName: ""
    }, this.saveCompositeRoles);
  },

  confirmRoleConfig() {
    const active = this.data.compositeRoles[this.data.activeRoleIndex];
    if (!active) return;
    const compositeRoles = this.data.compositeRoles.map((item) => (
      item.key === active.key ? { ...item, members: this.data.roleDraftMembers.slice() } : item
    ));
    this.setData({ compositeRoles }, this.saveCompositeRoles);
  },

  saveCompositeRoles() {
    wx.setStorageSync(ROLE_CONFIG_KEY, this.data.compositeRoles);
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: {
          key: "compositeRoles",
          value: this.data.compositeRoles,
          operator: (getCurrentUser() || {}).name || ""
        }
      }).catch(() => {});
    }
    wx.showToast({ title: "综合人员配置已保存", icon: "none" });
  },

  goDepartmentManage() {
    if (!this.data.canGlobalManage) {
      wx.showToast({ title: "仅全局管理员可管理科室", icon: "none" });
      return;
    }

    wx.navigateTo({ url: "/pages/department-manage/department-manage" });
  },

  goPeopleManage() {
    wx.navigateTo({ url: "/pages/people-manage/people-manage" });
  },

  onRoomInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`roomForm.${field}`]: event.detail.value });
  },

  loadMeetingRooms() {
    if (!wx.cloud) {
      this.setData({ meetingRooms });
      return;
    }
    wx.cloud.callFunction({ name: "listMeetingRooms" }).then((res) => {
      const result = res.result || {};
      this.setData({
        meetingRooms: result.ok && result.rooms && result.rooms.length ? result.rooms : meetingRooms
      });
    }).catch(() => {
      this.setData({ meetingRooms });
    });
  },

  createMeetingRoom() {
    if (!this.data.canGlobalManage) {
      wx.showToast({ title: "仅全局管理员可添加", icon: "none" });
      return;
    }
    const form = this.data.roomForm;
    if (!form.name || !form.capacity) {
      wx.showToast({ title: "请填写会议室和人数", icon: "none" });
      return;
    }
    if (!wx.cloud) {
      wx.showToast({ title: "云开发未初始化", icon: "none" });
      return;
    }

    this.setData({ roomSubmitting: true });
    wx.cloud.callFunction({
      name: "createMeetingRoom",
      data: {
        name: form.name,
        capacity: Number(form.capacity),
        features: form.features
      }
    }).then((res) => {
      const result = res.result || {};
      wx.showToast({
        title: result.ok ? "会议室已添加" : (result.message || "添加失败"),
        icon: result.ok ? "success" : "none"
      });
      this.setData({ roomSubmitting: false });
      if (result.ok) {
        this.setData({
          roomForm: {
            name: "",
            capacity: "",
            features: ""
          }
        });
        this.loadMeetingRooms();
      }
    }).catch((error) => {
      const message = String(error.errMsg || "");
      this.setData({ roomSubmitting: false });
      wx.showToast({
        title: message.indexOf("FUNCTION_NOT_FOUND") >= 0 ? "请先上传会议室云函数" : (message || "添加失败"),
        icon: "none"
      });
    });
  },

  goDepartmentDetail(event) {
    wx.navigateTo({
      url: `/pages/department-detail/department-detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
