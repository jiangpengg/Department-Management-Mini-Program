const { ensureAuthorized, getCurrentUser, canManageSystem, canManageDepartment } = require("../../utils/auth");
const { loadOrgConfig, saveOrgConfig } = require("../../utils/org-store");

Page({
  data: {
    department: {},
    members: [],
    allUsers: [],
    searchKeyword: "",
    searchResults: []
  },

  async onLoad(options) {
    if (!ensureAuthorized()) return;
    if (!canManageDepartment()) {
      wx.showToast({ title: "无科室配置权限", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    this.orgConfig = await loadOrgConfig({ operator: (getCurrentUser() || {}).name || "" });
    const department = this.orgConfig.departments.find((item) => item.id === options.id) || this.orgConfig.departments[0];
    if (!canManageSystem() && department.name !== getCurrentUser().department) {
      wx.showToast({ title: "只能管理本科室", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    this.setData({
      department,
      allUsers: this.orgConfig.users
    });
    this.refreshMembers(department.name, this.orgConfig.users);
  },

  refreshMembers(departmentName, userList = this.data.allUsers) {
    this.setData({
      members: userList.filter((item) => item.department === departmentName && item.authorized)
    });
  },

  onSearch(event) {
    const keyword = event.detail.value.trim();
    const members = new Set(this.data.members.map((item) => item.id));
    this.setData({
      searchKeyword: keyword,
      searchResults: keyword
        ? this.data.allUsers.filter((item) => item.name.includes(keyword) && !members.has(item.id))
        : []
    });
  },

  addExistingMember(event) {
    const userId = event.currentTarget.dataset.id;
    const usersNext = this.data.allUsers.map((item) => (
      item.id === userId ? { ...item, department: this.data.department.name, authorized: true } : item
    ));
    this.setData({ allUsers: usersNext, searchKeyword: "", searchResults: [] });
    this.refreshMembers(this.data.department.name, usersNext);
    this.saveUsers(usersNext, "已加入科室");
  },

  removeMember(event) {
    const userId = event.currentTarget.dataset.id;
    const usersNext = this.data.allUsers.map((item) => (
      item.id === userId ? { ...item, department: "未分配" } : item
    ));
    this.setData({ allUsers: usersNext });
    this.refreshMembers(this.data.department.name, usersNext);
    this.saveUsers(usersNext, "已移出科室");
  },

  saveUsers(users, toastTitle) {
    this.orgConfig = { ...this.orgConfig, users };
    saveOrgConfig(this.orgConfig, (getCurrentUser() || {}).name || "").then((result) => {
      wx.showToast({
        title: result.ok ? toastTitle : `${toastTitle}，本地已暂存`,
        icon: "none"
      });
    }).catch(() => {
      wx.showToast({ title: `${toastTitle}，本地已暂存`, icon: "none" });
    });
  }
});
