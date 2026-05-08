Page({
  data: {
    user: {},
    avatarText: ""
  },

  onLoad() {
    const user = getApp().globalData.user;
    this.setData({
      user,
      avatarText: user.name.slice(-1)
    });
  }
});
