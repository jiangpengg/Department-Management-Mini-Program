const { projects, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

const PROJECT_CONFIG_KEY = "projectProgress";

Page({
  data: {
    projects: []
  },

  async onLoad() {
    if (!ensureAuthorized()) return;
    const projectList = await this.loadProjects();
    this.setData({
      projects: projectList.map((item) => {
        const meta = getStatusMeta(item.status);
        return { ...item, statusText: meta.text, statusTone: meta.tone };
      })
    });
  },

  async loadProjects() {
    if (!wx.cloud) return projects;
    try {
      const res = await wx.cloud.callFunction({
        name: "listAdminConfigs",
        data: { keys: [PROJECT_CONFIG_KEY] }
      });
      const result = res.result || {};
      const remote = result.ok && result.configs ? result.configs[PROJECT_CONFIG_KEY] : null;
      if (remote && remote.length) return remote;
      wx.cloud.callFunction({
        name: "updateAdminConfig",
        data: {
          key: PROJECT_CONFIG_KEY,
          value: projects,
          operator: (getApp().globalData.user || {}).name || ""
        }
      }).catch(() => {});
      return projects;
    } catch (error) {
      return projects;
    }
  },

  onShow() {
    if (this.getTabBar) {
      this.getTabBar().setData({ selected: 3 });
    }
  }
});
