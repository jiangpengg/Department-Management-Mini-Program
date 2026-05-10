const { ensureAuthorized, canManageSystem, getCurrentUser } = require("../../utils/auth");
const { loadOrgConfig, saveOrgConfig } = require("../../utils/org-store");

Page({
  data: {
    departments: []
  },

  async onLoad() {
    if (!ensureAuthorized()) return;
    if (!canManageSystem()) {
      wx.showToast({ title: "无科室管理权限", icon: "none" });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }
    this.orgConfig = await loadOrgConfig({ operator: (getCurrentUser() || {}).name || "" });
    this.setData({ departments: this.decorateDepartments(this.orgConfig.departments) });
  },

  decorateDepartments(list) {
    return list.map((department) => ({
      ...department,
      memberCount: (this.orgConfig.users || []).filter((user) => user.department === department.name && user.authorized).length
    }));
  },

  addDepartment() {
    const index = this.data.departments.length + 1;
    const departments = [
      ...(this.orgConfig.departments || []),
      {
        id: `d${Date.now()}`,
        name: `新增科室${index}`,
        leader: "待设置",
        reviewer: "待设置",
        safetyOfficer: "待设置",
        partyOfficer: "待设置",
        memberCount: 0
      }
    ];
    this.saveDepartments(departments, "已新增科室");
  },

  deleteDepartment(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.departments.find((item) => item.id === id);
    if (!target) return;
    if (target.memberCount > 0) {
      wx.showToast({ title: "请先移出人员", icon: "none" });
      return;
    }
    this.saveDepartments((this.orgConfig.departments || []).filter((item) => item.id !== id), "已删除科室");
  },

  saveDepartments(departments, toastTitle) {
    this.orgConfig = { ...this.orgConfig, departments };
    this.setData({ departments: this.decorateDepartments(departments) });
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
