const { departments, users, roles } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, canManageSystem, canManageDepartment, getManageScope } = require("../../utils/auth");

Page({
  data: {
    users: [],
    departmentNames: [],
    roleNames: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!canManageDepartment()) {
      wx.showToast({ title: "无人员管理权限", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    const currentUser = getCurrentUser();
    const scope = getManageScope();
    const visibleUsers = scope === "global"
      ? users
      : users.filter((item) => item.department === currentUser.department);
    const visibleDepartments = scope === "global"
      ? departments
      : departments.filter((item) => item.name === currentUser.department);

    this.setData({
      users: visibleUsers,
      departmentNames: visibleDepartments.map((item) => item.name),
      roleNames: roles.map((item) => item.name)
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

    this.setData({
      users: this.data.users.map((item) => (
        item.id === userId ? { ...item, department, authorized: true } : item
      ))
    });
    this.showDraftToast("已设置部门");
  },

  setRole(event) {
    const userId = event.currentTarget.dataset.id;
    const role = roles[Number(event.detail.value)];
    if (!role) return;
    this.setData({
      users: this.data.users.map((item) => (
        item.id === userId ? { ...item, role: role.name, roleKey: role.key, authorized: true } : item
      ))
    });
    this.showDraftToast("已设置角色");
  },

  toggleAuthorized(event) {
    const userId = event.currentTarget.dataset.id;
    this.setData({
      users: this.data.users.map((item) => (
        item.id === userId ? { ...item, authorized: !item.authorized } : item
      ))
    });
    this.showDraftToast("已更新授权");
  },

  showDraftToast(title) {
    wx.showToast({
      title: `${title}，待接入云端保存`,
      icon: "none"
    });
  }
});
