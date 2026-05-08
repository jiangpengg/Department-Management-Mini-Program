const { departments, users } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    departments: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!hasCapability("system_config")) {
      wx.showToast({ title: "无科室管理权限", icon: "none" });
      wx.navigateBack();
      return;
    }
    this.setData({ departments: this.decorateDepartments(departments) });
  },

  decorateDepartments(list) {
    return list.map((department) => ({
      ...department,
      memberCount: users.filter((user) => user.department === department.name && user.authorized).length
    }));
  },

  addDepartment() {
    const index = this.data.departments.length + 1;
    this.setData({
      departments: [
        ...this.data.departments,
        {
          id: `d${Date.now()}`,
          name: `新增科室${index}`,
          leader: "待设置",
          reviewer: "待设置",
          safetyOfficer: "待设置",
          partyOfficer: "待设置",
          memberCount: 0
        }
      ]
    });
    this.showDraftToast("已新增科室");
  },

  deleteDepartment(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.departments.find((item) => item.id === id);
    if (!target) return;
    if (target.memberCount > 0) {
      wx.showToast({ title: "请先移出人员", icon: "none" });
      return;
    }
    this.setData({
      departments: this.data.departments.filter((item) => item.id !== id)
    });
    this.showDraftToast("已删除科室");
  },

  showDraftToast(title) {
    wx.showToast({
      title: `${title}，待接入云端保存`,
      icon: "none"
    });
  }
});
