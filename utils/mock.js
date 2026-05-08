const statusMap = {
  draft: { text: "草稿", tone: "gray" },
  pending: { text: "待审批", tone: "amber" },
  approved: { text: "已通过", tone: "green" },
  rejected: { text: "已驳回", tone: "red" },
  processing: { text: "进行中", tone: "blue" },
  overdue: { text: "已逾期", tone: "red" },
  done: { text: "已完成", tone: "green" },
  risk: { text: "有风险", tone: "red" }
};

const applicationTypes = [
  {
    key: "meeting",
    name: "腾讯会议申请",
    desc: "选择日期、开始时间和时长",
    icon: "会",
    approvalRequired: false
  },
  {
    key: "room",
    name: "会议室申请",
    desc: "会议室预约、时间冲突检查、使用记录",
    icon: "室",
    approvalRequired: false
  },
  {
    key: "seal",
    name: "印章申请",
    desc: "用章类型、材料附件、审批留痕",
    icon: "章",
    approvalRequired: true
  }
];

const roles = [
  {
    key: "system_admin",
    name: "最高管理人员",
    desc: "配置全所所有人员、部门、角色和管理权限",
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"]
  },
  {
    key: "staff",
    name: "普通员工",
    desc: "提交申请、查看自己的任务和项目事项",
    capabilities: ["apply"]
  },
  {
    key: "reviewer",
    name: "审核人员",
    desc: "审核会议、会议室、印章等申请",
    capabilities: ["apply", "approve"]
  },
  {
    key: "department_manager",
    name: "部门管理人员",
    desc: "配置全所人员权限、审批流程和部门数据",
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"]
  },
  {
    key: "section_manager",
    name: "科室管理人员",
    desc: "仅配置本科室人员的部门、角色和授权状态",
    capabilities: ["apply", "approve", "department_admin"]
  },
  {
    key: "institute_leader",
    name: "所领导",
    desc: "查看全所事项、终审重点流程和项目风险",
    capabilities: ["approve", "project_manage", "global_view"]
  },
  {
    key: "safety_officer",
    name: "安全员",
    desc: "负责本科室安全事项提醒、台账和风险反馈",
    capabilities: ["apply", "task_manage"]
  },
  {
    key: "party_officer",
    name: "党建员",
    desc: "负责本科室党建任务、材料提醒和活动记录",
    capabilities: ["apply", "task_manage"]
  }
];

const departments = [
  {
    id: "d001",
    name: "科技管理科",
    leader: "张明",
    reviewer: "王珂",
    safetyOfficer: "刘洋",
    partyOfficer: "秦佳",
    memberCount: 12
  },
  {
    id: "d002",
    name: "综合办公室",
    leader: "沈越",
    reviewer: "赵敏",
    safetyOfficer: "陈宁",
    partyOfficer: "周倩",
    memberCount: 8
  },
  {
    id: "d003",
    name: "工程技术科",
    leader: "秦佳",
    reviewer: "陈宁",
    safetyOfficer: "王珂",
    partyOfficer: "赵敏",
    memberCount: 21
  }
];

const users = [
  {
    id: "u001",
    name: "张明",
    department: "科技管理科",
    role: "部门管理人员",
    roleKey: "department_manager",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["科技项目", "任务推送"]
  },
  {
    id: "u002",
    name: "王珂",
    department: "科技管理科",
    role: "审核人员",
    roleKey: "reviewer",
    authorized: true,
    capabilities: ["apply", "approve"],
    reviewerFor: ["腾讯会议", "会议室"]
  },
  {
    id: "u003",
    name: "赵敏",
    department: "综合办公室",
    role: "审核人员",
    roleKey: "reviewer",
    authorized: true,
    capabilities: ["apply", "approve"],
    reviewerFor: ["印章"]
  },
  {
    id: "u004",
    name: "刘洋",
    department: "科技管理科",
    role: "普通员工",
    roleKey: "staff",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u006",
    name: "秦佳",
    department: "工程技术科",
    role: "党建员",
    roleKey: "party_officer",
    authorized: true,
    capabilities: ["apply", "task_manage"],
    reviewerFor: []
  },
  {
    id: "u007",
    name: "周倩",
    department: "综合办公室",
    role: "党建员",
    roleKey: "party_officer",
    authorized: true,
    capabilities: ["apply", "task_manage"],
    reviewerFor: []
  },
  {
    id: "u005",
    name: "外部访客",
    department: "未授权",
    role: "访客",
    roleKey: "guest",
    authorized: false,
    capabilities: [],
    reviewerFor: []
  }
];

const approvalFlows = [
  {
    type: "腾讯会议",
    approvalRequired: false,
    steps: ["申请人提交", "部门审核人员审核", "部门负责人确认"],
    reviewer: "王珂",
    leader: "张明"
  },
  {
    type: "会议室",
    approvalRequired: false,
    steps: ["申请人提交", "综合办公室审核", "自动写入会议室台账"],
    reviewer: "王珂",
    leader: "沈越"
  },
  {
    type: "印章",
    approvalRequired: true,
    steps: ["申请人提交", "综合办公室初审", "所领导终审", "用章登记"],
    reviewer: "赵敏",
    leader: "沈越"
  },
  {
    type: "科技项目",
    approvalRequired: true,
    steps: ["项目负责人更新", "部门负责人审核", "所领导查看风险"],
    reviewer: "张明",
    leader: "所领导"
  }
];

const applications = [
  {
    id: "A20260501001",
    type: "腾讯会议",
    title: "省级科技项目启动会",
    applicant: "刘洋",
    time: "2026-05-06 09:30",
    status: "approved",
    approvalRequired: false,
    detail: "申请创建腾讯会议，预计 18 人参会。"
  },
  {
    id: "A20260501002",
    type: "会议室",
    title: "二楼 203 会议室",
    applicant: "周倩",
    time: "2026-05-07 14:00",
    status: "approved",
    approvalRequired: false,
    detail: "项目评审会，需投影和视频设备。"
  },
  {
    id: "A20260430009",
    type: "印章",
    title: "合作协议用章",
    applicant: "陈宁",
    time: "2026-05-08 10:00",
    status: "pending",
    approvalRequired: true,
    detail: "合同章 3 份，附件已上传。"
  }
];

const tasks = [
  {
    id: "T001",
    title: "提交重点研发项目月报",
    owner: "王珂",
    deadline: "2026-05-05",
    priority: "高",
    status: "processing",
    progress: 60
  },
  {
    id: "T002",
    title: "补充会议纪要和参会签到",
    owner: "刘洋",
    deadline: "2026-05-03",
    priority: "中",
    status: "pending",
    progress: 20
  },
  {
    id: "T003",
    title: "归档第一季度用章台账",
    owner: "赵敏",
    deadline: "2026-04-28",
    priority: "中",
    status: "overdue",
    progress: 75
  }
];

const projects = [
  {
    id: "P001",
    name: "新能源设备智能运维平台",
    leader: "张明",
    stage: "中期检查",
    nextNode: "提交中期材料",
    deadline: "2026-05-20",
    status: "processing",
    progress: 68,
    budget: "120 万"
  },
  {
    id: "P002",
    name: "数字化安全评价体系研究",
    leader: "沈越",
    stage: "立项评审",
    nextNode: "专家评审会",
    deadline: "2026-05-12",
    status: "risk",
    progress: 42,
    budget: "80 万"
  },
  {
    id: "P003",
    name: "碳资产数据治理示范项目",
    leader: "秦佳",
    stage: "验收准备",
    nextNode: "验收材料归档",
    deadline: "2026-06-02",
    status: "approved",
    progress: 90,
    budget: "95 万"
  }
];

const roomSlots = [
  { room: "201 综合会议室", time: "09:00-11:00", status: "available" },
  { room: "203 视频会议室", time: "14:00-16:00", status: "busy" },
  { room: "305 洽谈室", time: "16:00-17:30", status: "available" }
];

function getStatusMeta(status) {
  return statusMap[status] || statusMap.draft;
}

function buildDashboard() {
  const pendingApprovals = applications.filter((item) => item.approvalRequired && item.status === "pending").length;
  const activeTasks = tasks.filter((item) => item.status !== "done").length;
  const riskProjects = projects.filter((item) => item.status === "risk").length;
  const todayMeetings = applications.filter((item) => item.type !== "印章").length;

  return [
    { label: "待审批", value: pendingApprovals, unit: "项" },
    { label: "任务推进", value: activeTasks, unit: "项" },
    { label: "项目风险", value: riskProjects, unit: "项" },
    { label: "会议预约", value: todayMeetings, unit: "项" }
  ];
}

module.exports = {
  applicationTypes,
  applications,
  roles,
  departments,
  users,
  approvalFlows,
  tasks,
  projects,
  roomSlots,
  getStatusMeta,
  buildDashboard
};
