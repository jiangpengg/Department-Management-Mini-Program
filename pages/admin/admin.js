const { departments, users, approvalFlows } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    departments,
    users: [],
    approvalFlows
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!hasCapability("system_config")) {
      wx.showToast({
        title: "无管理配置权限",
        icon: "none"
      });
      wx.switchTab({
        url: "/pages/profile/profile"
      });
      return;
    }

    this.setData({
      users: users.map((item) => ({
        ...item,
        reviewerForText: item.reviewerFor.join("、")
      }))
    });
  }
});
