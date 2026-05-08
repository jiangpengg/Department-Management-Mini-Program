const { departments, users, approvalFlows } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, canManageSystem, canManageDepartment, getManageScope } = require("../../utils/auth");

Page({
  data: {
    departments: [],
    users: [],
    approvalFlows,
    scope: "self",
    canGlobalManage: false
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!canManageDepartment()) {
      wx.showToast({
        title: "无管理配置权限",
        icon: "none"
      });
      wx.switchTab({ url: "/pages/profile/profile" });
      return;
    }

    const scope = getManageScope();
    const currentUser = getCurrentUser();
    const visibleUsers = scope === "global"
      ? users
      : users.filter((item) => item.department === currentUser.department);
    const visibleDepartments = scope === "global"
      ? departments
      : departments.filter((item) => item.name === currentUser.department);

    this.setData({
      scope,
      canGlobalManage: canManageSystem(),
      departments: this.decorateDepartments(visibleDepartments, users),
      users: this.decorateUsers(visibleUsers),
      approvalFlows: approvalFlows.filter((item) => item.approvalRequired)
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
    if (!this.data.canGlobalManage) {
      wx.showToast({ title: "仅全局管理员可管理科室", icon: "none" });
      return;
    }

    wx.navigateTo({
      url: "/pages/department-manage/department-manage"
    });
  },

  goPeopleManage() {
    wx.navigateTo({
      url: "/pages/people-manage/people-manage"
    });
  },

  goDepartmentDetail(event) {
    wx.navigateTo({
      url: `/pages/department-detail/department-detail?id=${event.currentTarget.dataset.id}`
    });
  }
});
