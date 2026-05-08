const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    user: {},
    avatarText: "",
    canConfig: false,
    capabilityText: ""
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    const user = getApp().globalData.user;
    this.setData({
      user,
      avatarText: user.name.slice(-1),
      canConfig: hasCapability("system_config"),
      capabilityText: (user.capabilities || []).join(" / ")
    });
  },

  goAdmin() {
    if (!this.data.canConfig) {
      wx.showToast({
        title: "无管理配置权限",
        icon: "none"
      });
      return;
    }

    wx.navigateTo({
      url: "/pages/admin/admin"
    });
  }
});
