const { projects, getStatusMeta } = require("../../utils/mock");

Page({
  data: {
    projects: []
  },

  onLoad() {
    this.setData({
      projects: projects.map((item) => {
        const meta = getStatusMeta(item.status);
        return { ...item, statusText: meta.text, statusTone: meta.tone };
      })
    });
  }
});
