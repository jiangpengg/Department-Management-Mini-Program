const { departments, users } = require("../../utils/mock");
const { ensureAuthorized } = require("../../utils/auth");

Page({
  data: {
    leaders: [],
    departments: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;

    this.setData({
      leaders: users.filter((item) => ["system_admin", "department_manager", "institute_leader"].includes(item.roleKey)),
      departments: departments.map((department) => ({
        ...department,
        members: users.filter((user) => user.department === department.name && user.authorized)
      }))
    });
  }
});
