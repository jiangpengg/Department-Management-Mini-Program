const { applications, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    filters: [
      { key: "all", name: "全部" },
      { key: "pending", name: "待审" },
      { key: "approved", name: "通过" },
      { key: "rejected", name: "驳回" }
    ],
    activeFilter: "all",
    applications: [],
    visibleApplications: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!hasCapability("approve")) {
      wx.showToast({
        title: "无审批权限",
        icon: "none"
      });
      wx.switchTab({
        url: "/pages/home/home"
      });
      return;
    }
    const list = applications.filter((item) => item.approvalRequired).map((item) => {
      const meta = getStatusMeta(item.status);
      return { ...item, statusText: meta.text, statusTone: meta.tone };
    });
    this.setData({ applications: list }, this.applyFilter);
  },

  switchFilter(event) {
    this.setData({
      activeFilter: event.currentTarget.dataset.key
    }, this.applyFilter);
  },

  applyFilter() {
    const { activeFilter, applications: list } = this.data;
    this.setData({
      visibleApplications: activeFilter === "all" ? list : list.filter((item) => item.status === activeFilter)
    });
  },

  handleApproval(event) {
    const { id, action } = event.currentTarget.dataset;
    const nextStatus = action === "approve" ? "approved" : "rejected";
    const nextList = this.data.applications.map((item) => {
      if (item.id !== id) return item;
      const meta = getStatusMeta(nextStatus);
      return { ...item, status: nextStatus, statusText: meta.text, statusTone: meta.tone };
    });

    this.setData({ applications: nextList }, this.applyFilter);
    wx.showToast({
      title: action === "approve" ? "已通过" : "已驳回",
      icon: "success"
    });
  }
});
