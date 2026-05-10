const { ensureAuthorized, getCurrentUser, canManageSystem, canManageDepartment, getManageScope } = require("../../utils/auth");
const { loadOrgConfig, saveOrgConfig } = require("../../utils/org-store");

Page({
  data: {
    users: [],
    departmentNames: [],
    roleNames: []
  },

  async onLoad() {
    if (!ensureAuthorized()) return;
    if (!canManageDepartment()) {
      wx.showToast({ title: "无人员管理权限", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    const orgConfig = await loadOrgConfig({ operator: (getCurrentUser() || {}).name || "" });
    this.orgConfig = orgConfig;
    const currentUser = getCurrentUser();
    const scope = getManageScope();
    const visibleUsers = scope === "global"
      ? orgConfig.users
      : orgConfig.users.filter((item) => item.department === currentUser.department);
    const visibleDepartments = scope === "global"
      ? orgConfig.departments
      : orgConfig.departments.filter((item) => item.name === currentUser.department);

    this.setData({
      users: visibleUsers,
      departmentNames: visibleDepartments.map((item) => item.name),
      roleNames: orgConfig.roles.map((item) => item.name)
    });
  },

  setDepartment(event) {
    const userId = event.currentTarget.dataset.id;
    const department = this.data.departmentNames[Number(event.detail.value)];
    if (!department) return;
    if (!canManageSystem() && department !== getCurrentUser().department) {
      wx.showToast({ title: "只能配置本科室人员", icon: "none" });
      return;
    }

    this.updateUser(userId, { department, authorized: true }, "已设置部门");
  },

  setRole(event) {
    const userId = event.currentTarget.dataset.id;
    const role = (this.orgConfig.roles || [])[Number(event.detail.value)];
    if (!role) return;
    this.updateUser(userId, { role: role.name, roleKey: role.key, authorized: true }, "已设置角色");
  },

  toggleAuthorized(event) {
    const userId = event.currentTarget.dataset.id;
    const target = this.data.users.find((item) => item.id === userId);
    if (!target) return;
    this.updateUser(userId, { authorized: !target.authorized }, "已更新授权");
  },

  updateUser(userId, patch, toastTitle) {
    const users = (this.orgConfig.users || []).map((item) => (
      item.id === userId ? { ...item, ...patch } : item
    ));
    this.orgConfig = { ...this.orgConfig, users };
    this.setData({
      users: this.data.users.map((item) => (
        item.id === userId ? { ...item, ...patch } : item
      ))
    });
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
