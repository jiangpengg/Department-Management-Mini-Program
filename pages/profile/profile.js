const { ensureAuthorized, canManageDepartment } = require("../../utils/auth");

Page({
  data: {
    user: {},
    avatarText: "",
    canConfig: false,
    capabilityText: "",
    cloudOpenid: "",
    cloudTestStatus: "未测试"
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    const user = getApp().globalData.user;
    this.setData({
      user,
      avatarText: user.name.slice(-1),
      canConfig: canManageDepartment(),
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
  },

  goOrgView() {
    wx.navigateTo({
      url: "/pages/org-view/org-view",
      fail: () => {
        wx.showToast({
          title: "组织架构页面未加载，请重新编译",
          icon: "none"
        });
      }
    });
  },

  testCloudLogin() {
    this.setData({
      cloudTestStatus: "正在调用 login 云函数...",
      cloudOpenid: ""
    });

    if (!wx.cloud) {
      this.setData({
        cloudTestStatus: "失败：wx.cloud 不可用，请确认导入项目时选择了微信云开发"
      });
      wx.showToast({
        title: "云开发未初始化",
        icon: "none"
      });
      return;
    }

    wx.cloud.callFunction({
      name: "login",
      success: (res) => {
        const openid = res.result && res.result.openid;
        this.setData({
          cloudTestStatus: "成功：login 云函数已连通",
          cloudOpenid: openid || "未获取到 openid"
        });
        wx.showToast({
          title: "云函数调用成功",
          icon: "success"
        });
      },
      fail: (error) => {
        this.setData({
          cloudTestStatus: "失败：login 云函数调用失败",
          cloudOpenid: error.errMsg || "调用失败"
        });
        wx.showToast({
          title: "云函数调用失败",
          icon: "none"
        });
      }
    });
  }
});
