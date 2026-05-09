const { initCloud } = require("./utils/cloud");

const debugUsers = {
  staff: {
    id: "u010",
    name: "董雪松",
    openid: "demo-staff-openid",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    authorized: true,
    capabilities: ["apply"]
  },
  sectionManager: {
    id: "u016",
    name: "林浩凡",
    openid: "demo-transformer-section-manager-openid",
    department: "变压器技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"]
  },
  globalManager: {
    id: "u001",
    name: "郑一鸣",
    openid: "demo-global-manager-openid",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"]
  }
};

App({
  onLaunch() {
    initCloud();
  },

  globalData: {
    // 调试时切换这里：debugUsers.staff / debugUsers.sectionManager / debugUsers.globalManager
    user: debugUsers.globalManager
  }
});
