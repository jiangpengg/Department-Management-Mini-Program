const { ensureAuthorized } = require("../../utils/auth");
const { loadOrgConfig } = require("../../utils/org-store");

Page({
  data: {
    leaders: [],
    departments: []
  },

  async onLoad() {
    if (!ensureAuthorized()) return;

    const orgConfig = await loadOrgConfig({ seed: false });
    const users = orgConfig.users || [];
    this.setData({
      leaders: users.filter((item) => ["system_admin", "department_manager", "institute_leader"].includes(item.roleKey)),
      departments: (orgConfig.departments || []).map((department) => ({
        ...department,
        members: users.filter((user) => user.department === department.name && user.authorized)
      }))
    });
  }
});
