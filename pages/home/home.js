const { applicationTypes, applications, projects, buildDashboard, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

Page({
  data: {
    user: {},
    metrics: [],
    applicationTypes,
    applications: [],
    riskProject: {}
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    const app = getApp();
    this.setData({
      user: app.globalData.user,
      metrics: buildDashboard(),
      applications: applications.slice(0, 3).map((item) => {
        const meta = getStatusMeta(item.status);
        return { ...item, statusText: meta.text, statusTone: meta.tone };
      }),
      riskProject: projects.find((item) => item.status === "risk") || projects[0]
    });
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
