const { projects, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

Page({
  data: {
    projects: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    this.setData({
      projects: projects.map((item) => {
        const meta = getStatusMeta(item.status);
        return { ...item, statusText: meta.text, statusTone: meta.tone };
      })
    });
  }
});
