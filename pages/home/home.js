const { applicationTypes, workItems, projects, buildDashboard, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

Page({
  data: {
    user: {},
    instituteName: "输变电技术研究所",
    weather: "晴 22℃",
    todayText: "",
    metrics: [],
    applicationTypes,
    onsiteWorks: [],
    emergencyWorks: [],
    projectWorks: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    const app = getApp();
    const user = app.globalData.user;
    this.setData({
      user,
      todayText: this.formatToday(),
      metrics: buildDashboard(user),
      onsiteWorks: this.decorateWorks(workItems.filter((item) => item.category === "onsite").slice(0, 3)),
      emergencyWorks: this.decorateWorks(workItems.filter((item) => item.category === "emergency" && item.status !== "done").slice(0, 3)),
      projectWorks: projects.slice(0, 3).map((item) => {
        const meta = getStatusMeta(item.status);
        return { ...item, statusText: meta.text, statusTone: meta.tone };
      })
    });
  },

  formatToday() {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日`;
  },

  decorateWorks(list) {
    return list.map((item) => {
      const meta = getStatusMeta(item.status);
      return { ...item, statusText: meta.text, statusTone: meta.tone };
    });
  },

  onShow() {
    if (this.getTabBar) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  goApply(event) {
    wx.navigateTo({
      url: `/pages/apply/apply?type=${event.currentTarget.dataset.type}`
    });
  },

  goApproval() {
    wx.switchTab({
      url: "/pages/approval/approval"
    });
  }
});
