const { initCloud } = require("./utils/cloud");

const debugUsers = {
  staff: {
    id: "u004",
    name: "刘洋",
    openid: "demo-staff-openid",
    department: "科技管理科",
    role: "普通员工",
    roleKey: "staff",
    authorized: true,
    capabilities: ["apply"]
  },
  sectionManager: {
    id: "u006",
    name: "秦佳",
    openid: "demo-section-manager-openid",
    department: "工程技术科",
    role: "科室管理人员",
    roleKey: "section_manager",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin"]
  },
  globalManager: {
    id: "u001",
    name: "张明",
    openid: "demo-global-manager-openid",
    department: "科技管理科",
    role: "最高/部门管理人员",
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
