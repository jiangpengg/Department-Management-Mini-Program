const { departments, users, approvalFlows } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    departments: [],
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
      departments: this.decorateDepartments(departments, users),
      users: this.decorateUsers(users)
    });
  },

  decorateDepartments(departmentList, userList) {
    return departmentList.map((department) => ({
      ...department,
      memberCount: userList.filter((user) => user.department === department.name && user.authorized).length
    }));
  },

  decorateUsers(userList) {
    return userList.map((item) => ({
      ...item,
      reviewerForText: item.reviewerFor.join("、")
    }));
  },

  goDepartmentManage() {
    wx.navigateTo({
      url: "/pages/department-manage/department-manage"
    });
  },

  goDepartmentDetail(event) {
    wx.navigateTo({
      url: `/pages/department-detail/department-detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
