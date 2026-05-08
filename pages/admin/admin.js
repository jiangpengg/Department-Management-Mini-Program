const { departments, users, roles, approvalFlows } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

Page({
  data: {
    departments: [],
    users: [],
    roles: [],
    authorizedUserNames: [],
    departmentNames: [],
    roleNames: [],
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
      users: this.decorateUsers(users),
      roles: this.decorateRoles(roles),
      authorizedUserNames: users.filter((item) => item.authorized).map((item) => item.name),
      departmentNames: departments.map((item) => item.name),
      roleNames: roles.map((item) => item.name)
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

  decorateRoles(roleList) {
    return roleList.map((item) => ({
      ...item,
      capabilityText: item.capabilities.join(" / ")
    }));
  },

  addDepartment() {
    const index = this.data.departments.length + 1;
    const name = `新增科室${index}`;
    const nextDepartments = [
      ...this.data.departments,
      {
        id: `d${Date.now()}`,
        name,
        leader: "待设置",
        reviewer: "待设置",
        safetyOfficer: "待设置",
        partyOfficer: "待设置",
        memberCount: 0
      }
    ];

    this.setData({ departments: nextDepartments });
    this.refreshDepartmentNames(nextDepartments);
    this.showDraftToast("已新增科室");
  },

  deleteDepartment(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.departments.find((item) => item.id === id);
    if (!target) return;
    if (target.memberCount > 0) {
      wx.showToast({
        title: "请先移出人员",
        icon: "none"
      });
      return;
    }

    const departmentsNext = this.data.departments.filter((item) => item.id !== id);
    this.setData({ departments: departmentsNext });
    this.refreshDepartmentNames(departmentsNext);
    this.showDraftToast("已删除科室");
  },

  setDeptPerson(event) {
    const { id, field } = event.currentTarget.dataset;
    const user = this.data.authorizedUserNames[Number(event.detail.value)];
    if (!user) return;

    this.setData({
      departments: this.data.departments.map((item) => (
        item.id === id ? { ...item, [field]: user } : item
      ))
    });
    this.showDraftToast("已更新配置");
  },

  moveUserDepartment(event) {
    const userId = event.currentTarget.dataset.id;
    const department = this.data.departmentNames[Number(event.detail.value)];
    if (!department) return;

    const usersNext = this.data.users.map((item) => (
      item.id === userId ? { ...item, department } : item
    ));

    this.setData({
      users: usersNext,
      departments: this.decorateDepartments(this.data.departments, usersNext)
    });
    this.showDraftToast("已调整科室");
  },

  changeUserRole(event) {
    const userId = event.currentTarget.dataset.id;
    const role = this.data.roles[Number(event.detail.value)];
    if (!role) return;

    this.setData({
      users: this.data.users.map((item) => (
        item.id === userId ? { ...item, role: role.name, roleKey: role.key } : item
      ))
    });
    this.showDraftToast("已调整角色");
  },

  addRole() {
    const index = this.data.roles.length + 1;
    const rolesNext = [
      ...this.data.roles,
      {
        key: `custom_${Date.now()}`,
        name: `自定义角色${index}`,
        desc: "可按所内管理要求配置权限能力",
        capabilities: ["apply"],
        capabilityText: "apply"
      }
    ];
    this.setData({ roles: rolesNext });
    this.refreshRoleNames(rolesNext);
    this.showDraftToast("已新增角色");
  },

  deleteRole(event) {
    const key = event.currentTarget.dataset.key;
    if (this.data.users.some((item) => item.roleKey === key)) {
      wx.showToast({
        title: "角色仍有人员使用",
        icon: "none"
      });
      return;
    }

    const rolesNext = this.data.roles.filter((item) => item.key !== key);
    this.setData({ roles: rolesNext });
    this.refreshRoleNames(rolesNext);
    this.showDraftToast("已删除角色");
  },

  refreshDepartmentNames(departmentList) {
    this.setData({
      departmentNames: departmentList.map((item) => item.name)
    });
  },

  refreshRoleNames(roleList) {
    this.setData({
      roleNames: roleList.map((item) => item.name)
    });
  },

  showDraftToast(title) {
    wx.showToast({
      title: `${title}，待接入云端保存`,
      icon: "none"
    });
  }
});
