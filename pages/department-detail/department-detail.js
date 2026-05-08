const { departments, users, roles } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    department: {},
    members: [],
    allUsers: [],
    departmentNames: [],
    roleNames: [],
    authorizedUserNames: []
  },

  onLoad(options) {
    if (!ensureAuthorized()) return;
    if (!hasCapability("system_config")) {
      wx.showToast({ title: "无科室配置权限", icon: "none" });
      wx.navigateBack();
      return;
    }

    const department = departments.find((item) => item.id === options.id) || departments[0];
    this.setData({
      department,
      allUsers: users,
      departmentNames: departments.map((item) => item.name),
      roleNames: roles.map((item) => item.name),
      authorizedUserNames: users.filter((item) => item.authorized).map((item) => item.name)
    });
    this.refreshMembers(department.name, users);
  },

  refreshMembers(departmentName, userList = this.data.allUsers) {
    this.setData({
      members: userList.filter((item) => item.department === departmentName && item.authorized)
    });
  },

  setDeptPerson(event) {
    const field = event.currentTarget.dataset.field;
    const user = this.data.authorizedUserNames[Number(event.detail.value)];
    if (!user) return;
    this.setData({
      department: { ...this.data.department, [field]: user }
    });
    this.showDraftToast("已更新岗位");
  },

  addMember() {
    const index = this.data.allUsers.length + 1;
    const member = {
      id: `u${Date.now()}`,
      name: `新增人员${index}`,
      department: this.data.department.name,
      role: "普通员工",
      roleKey: "staff",
      authorized: true,
      reviewerFor: []
    };
    const usersNext = [...this.data.allUsers, member];
    this.setData({ allUsers: usersNext });
    this.refreshMembers(this.data.department.name, usersNext);
    this.showDraftToast("已新增人员");
  },

  removeMember(event) {
    const userId = event.currentTarget.dataset.id;
    const usersNext = this.data.allUsers.map((item) => (
      item.id === userId ? { ...item, department: "未分配", authorized: false } : item
    ));
    this.setData({ allUsers: usersNext });
    this.refreshMembers(this.data.department.name, usersNext);
    this.showDraftToast("已移出人员");
  },

  moveUserDepartment(event) {
    const userId = event.currentTarget.dataset.id;
    const department = this.data.departmentNames[Number(event.detail.value)];
    if (!department) return;
    const usersNext = this.data.allUsers.map((item) => (
      item.id === userId ? { ...item, department } : item
    ));
    this.setData({ allUsers: usersNext });
    this.refreshMembers(this.data.department.name, usersNext);
    this.showDraftToast("已调整科室");
  },

  changeUserRole(event) {
    const userId = event.currentTarget.dataset.id;
    const role = roles[Number(event.detail.value)];
    if (!role) return;
    const usersNext = this.data.allUsers.map((item) => (
      item.id === userId ? { ...item, role: role.name, roleKey: role.key } : item
    ));
    this.setData({ allUsers: usersNext });
    this.refreshMembers(this.data.department.name, usersNext);
    this.showDraftToast("已调整角色");
  },

  showDraftToast(title) {
    wx.showToast({
      title: `${title}，待接入云端保存`,
      icon: "none"
    });
  }
});
