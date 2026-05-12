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
  },
  {
    key: "instrument",
    name: "仪器借用申请",
    desc: "仪器借用、出入库登记、现场工作联动",
    icon: "仪",
    approvalRequired: false
  },
  {
    key: "return",
    name: "仪器归还申请",
    desc: "关联现场任务、核对借用设备、入库登记",
    icon: "还",
    approvalRequired: false
  }
];

const instruments = [
  { id: "I001", name: "红外测温仪", model: "FLIR-T540", stock: 2, available: 2, unit: "台" },
  { id: "I002", name: "局放检测仪", model: "PD-3000", stock: 1, available: 1, unit: "套" },
  { id: "I003", name: "接地电阻测试仪", model: "UT521", stock: 3, available: 3, unit: "台" }
];

const equipmentTemplates = {
  temperature: [
    { instrumentId: "I001", name: "红外测温仪", quantity: 1, purpose: "设备温度核查" }
  ],
  grounding: [
    { instrumentId: "I003", name: "接地电阻测试仪", quantity: 1, purpose: "接地状态复核" }
  ],
  discharge: [
    { instrumentId: "I002", name: "局放检测仪", quantity: 1, purpose: "局放检测" }
  ]
};

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
    name: "负责人",
    leader: "郑一鸣",
    reviewer: "郑一鸣",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 9
  },
  {
    id: "d002",
    name: "变压器技术室",
    leader: "林浩凡",
    reviewer: "林浩凡",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 16
  },
  {
    id: "d003",
    name: "开关技术室",
    leader: "王绍安",
    reviewer: "王绍安",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 12
  },
  {
    id: "d004",
    name: "设备监控技术室",
    leader: "蒋鹏",
    reviewer: "蒋鹏",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 10
  },
  {
    id: "d005",
    name: "输电技术室",
    leader: "李特",
    reviewer: "李特",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 13
  },
  {
    id: "d006",
    name: "材料技术室",
    leader: "赵洲峰",
    reviewer: "赵洲峰",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 10
  },
  {
    id: "d007",
    name: "化学技术室",
    leader: "宋小宁",
    reviewer: "宋小宁",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 12
  },
  {
    id: "d008",
    name: "环保技术室",
    leader: "李治国",
    reviewer: "李治国",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 8
  },
  {
    id: "d009",
    name: "计量技术室",
    leader: "王一帆",
    reviewer: "王一帆",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 7
  },
  {
    id: "d010",
    name: "质监监督技术室",
    leader: "邵乔乐",
    reviewer: "邵乔乐",
    safetyOfficer: "",
    partyOfficer: "",
    memberCount: 1
  }
];

const users = [
  {
    id: "u001",
    name: "郑一鸣",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "所长",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u002",
    name: "孙翔",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "党总支书记、副所长",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u003",
    name: "陈孝信",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "副总师",
    expertLevel: "三级专家",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u004",
    name: "王达峰",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "副所长",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u005",
    name: "韩睿",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "副所长（国网设备部挂职）",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u006",
    name: "周宇通",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "副所长（办公室挂职）",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u007",
    name: "金凌峰",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "副所长",
    expertLevel: "五级专家",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u008",
    name: "王威",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "院五级职员",
    expertLevel: "院五级职员",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u009",
    name: "吉逸民",
    department: "负责人",
    role: "所级管理人员",
    roleKey: "department_manager",
    title: "三级协理",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "task_manage", "project_manage", "system_config", "global_admin"],
    reviewerFor: ["印章", "现场工作", "重点工作", "科技项目"]
  },
  {
    id: "u010",
    name: "董雪松",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u011",
    name: "王文浩",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "三级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u012",
    name: "詹江洋",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "三级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u013",
    name: "杨智",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u014",
    name: "郭全军",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u015",
    name: "于兵",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u016",
    name: "林浩凡",
    department: "变压器技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "",
    expertLevel: "助理专家",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u017",
    name: "孙明",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u018",
    name: "梁苏宁",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u019",
    name: "季宇豪",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u020",
    name: "周童浩",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u021",
    name: "龚夕霞",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u022",
    name: "蒋仕",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u023",
    name: "郭呈",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u024",
    name: "王劭鹤",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u025",
    name: "金浩远",
    department: "变压器技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u026",
    name: "王绍安",
    department: "开关技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "副主管",
    expertLevel: "四级专家",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u027",
    name: "金涌涛",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "三级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u028",
    name: "赵琳",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u029",
    name: "李斐然",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u030",
    name: "蔺家骏",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "建分挂职",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u031",
    name: "徐冬梅",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u032",
    name: "姜雄伟",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u033",
    name: "张恬波",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u034",
    name: "赵璐旻",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u035",
    name: "朱其杰",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u036",
    name: "张士元",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u037",
    name: "王宗扬",
    department: "开关技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u038",
    name: "蒋鹏",
    department: "设备监控技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "代管",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u039",
    name: "童杭伟",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "七级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u040",
    name: "罗盛",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "六级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u041",
    name: "李思南",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u042",
    name: "蒋建玲",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "七级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u043",
    name: "温典",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u044",
    name: "郭涛",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u045",
    name: "刘爽",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u046",
    name: "冯宇哲",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u047",
    name: "杨立川",
    department: "设备监控技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u048",
    name: "李特",
    department: "输电技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "主管",
    expertLevel: "四级专家",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u049",
    name: "曹俊平",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u050",
    name: "王尊",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u051",
    name: "李泽宇",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u052",
    name: "陶瑞祥",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u053",
    name: "何坚",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u054",
    name: "姜凯华",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u055",
    name: "赵亚龙",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u056",
    name: "马钰",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u057",
    name: "叶昊亮",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u058",
    name: "王博闻",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u059",
    name: "奚圣羽",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u060",
    name: "洪泽林",
    department: "输电技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u061",
    name: "赵洲峰",
    department: "材料技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "主管",
    expertLevel: "三级专家",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u062",
    name: "周进",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "六级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u063",
    name: "杨点中",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u064",
    name: "罗宏建",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "六级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u065",
    name: "陈小林",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "七级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u066",
    name: "郑宏晔",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u067",
    name: "陈胤桢",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u068",
    name: "周正",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u069",
    name: "鲁旷达",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "助理专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u070",
    name: "裘吕超",
    department: "材料技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u071",
    name: "宋小宁",
    department: "化学技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "主管",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u072",
    name: "洪灿飞",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "七级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u073",
    name: "明菊兰",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u074",
    name: "李海燕",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u075",
    name: "夏涛",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u076",
    name: "曹求洋",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u077",
    name: "周海飞",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "五级专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u078",
    name: "郭帅",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u079",
    name: "余璐静",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u080",
    name: "柳森",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u081",
    name: "孙兵阳",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u082",
    name: "余斌",
    department: "化学技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u083",
    name: "李治国",
    department: "环保技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "主管",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u084",
    name: "曹志勇",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u085",
    name: "崔亚兵",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u086",
    name: "刘敏",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u087",
    name: "孙桐",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "助理专家",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u088",
    name: "李锦涛",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u089",
    name: "王河",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u090",
    name: "金立正",
    department: "环保技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u091",
    name: "王一帆",
    department: "计量技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "代管",
    expertLevel: "助理专家",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
  },
  {
    id: "u092",
    name: "顾冰",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "七级职员",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u093",
    name: "陶定峰",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u094",
    name: "李航康",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u095",
    name: "骆丽",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u096",
    name: "宋琦华",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u097",
    name: "邹成伍",
    department: "计量技术室",
    role: "普通员工",
    roleKey: "staff",
    title: "",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply"],
    reviewerFor: []
  },
  {
    id: "u098",
    name: "邵乔乐",
    department: "质监监督技术室",
    role: "科室管理人员",
    roleKey: "section_manager",
    title: "副主管，建分挂职",
    expertLevel: "",
    authorized: true,
    capabilities: ["apply", "approve", "department_admin", "task_manage"],
    reviewerFor: ["印章", "现场工作", "重点工作"]
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
    steps: ["申请人提交", "科室领导审批", "所领导审批", "用章登记"],
    reviewer: "科室领导",
    leader: "所领导"
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
    applicantRoleKey: "safety_officer",
    department: "工程技术科",
    time: "2026-05-08 10:00",
    status: "pending",
    approvalRequired: true,
    detail: "合同章 3 份，附件已上传。",
    approvalFlow: buildSealApprovalFlow({
      roleKey: "safety_officer",
      department: "工程技术科"
    }),
    currentStepIndex: 0
  }
];

function buildSealApprovalFlow(user) {
  const isSectionLeader = user && user.roleKey === "section_manager";
  return isSectionLeader
    ? [
      { key: "institute", name: "所领导审批", role: "所领导" },
      { key: "register", name: "用章登记", role: "综合办公室" }
    ]
    : [
      { key: "section", name: "科室领导审批", role: `${user && user.department ? user.department : "本科室"}领导` },
      { key: "institute", name: "所领导审批", role: "所领导" },
      { key: "register", name: "用章登记", role: "综合办公室" }
    ];
}

const tasks = [
  {
    id: "T001",
    title: "提交重点研发项目月报",
    owner: "王珂",
    department: "科技管理科",
    category: "normal",
    deadline: "2026-05-05",
    priority: "高",
    status: "processing",
    progress: 60
  },
  {
    id: "T002",
    title: "补充会议纪要和参会签到",
    owner: "刘洋",
    department: "科技管理科",
    category: "normal",
    deadline: "2026-05-03",
    priority: "中",
    status: "pending",
    progress: 20
  },
  {
    id: "T003",
    title: "归档第一季度用章台账",
    owner: "赵敏",
    department: "综合办公室",
    category: "normal",
    deadline: "2026-04-28",
    priority: "中",
    status: "overdue",
    progress: 75
  }
];

const workItems = [
  {
    id: "W001",
    category: "onsite",
    title: "变电站保护装置现场核查",
    owner: "刘洋",
    department: "科技管理科",
    date: "2026-05-08",
    startTime: "09:00",
    endDate: "2026-05-08",
    endTime: "17:00",
    deadline: "2026-05-08",
    status: "pending",
    priority: "3",
    riskLevel: "3",
    projectType: "temperature",
    progress: 50
    ,
    equipmentDetails: [
      { instrumentId: "I001", name: "红外测温仪", quantity: 1, purpose: "设备温度核查" }
    ]
  },
  {
    id: "W002",
    category: "onsite",
    title: "输电线路通道隐患复核",
    owner: "秦佳",
    department: "工程技术科",
    date: "2026-05-09",
    startTime: "08:30",
    endDate: "2026-05-09",
    endTime: "16:30",
    deadline: "2026-05-09",
    status: "pending",
    priority: "2",
    riskLevel: "2",
    projectType: "grounding",
    progress: 20
    ,
    equipmentDetails: [
      { instrumentId: "I003", name: "接地电阻测试仪", quantity: 1, purpose: "接地状态复核" }
    ]
  },
  {
    id: "W003",
    category: "onsite",
    title: "设备改造现场交底",
    owner: "张明",
    department: "科技管理科",
    date: "2026-05-11",
    startTime: "09:00",
    endDate: "2026-05-11",
    endTime: "12:00",
    deadline: "2026-05-11",
    status: "processing",
    priority: "2",
    riskLevel: "2",
    projectType: "temperature",
    progress: 30
  },
  {
    id: "W004",
    category: "emergency",
    title: "主变综合在线监测异常跟踪",
    owner: "王珂",
    department: "科技管理科",
    date: "2026-05-07",
    deadline: "2026-05-10",
    status: "processing",
    priority: "高",
    progress: 65
  },
  {
    id: "W005",
    category: "emergency",
    title: "暴雨后站内排水隐患处置",
    owner: "陈宁",
    department: "工程技术科",
    date: "2026-05-08",
    deadline: "2026-05-09",
    status: "pending",
    priority: "高",
    progress: 35
  },
  {
    id: "W006",
    category: "key",
    title: "年度技术监督重点任务闭环",
    owner: "刘洋",
    department: "科技管理科",
    date: "2026-05-06",
    deadline: "2026-05-20",
    status: "processing",
    priority: "高",
    progress: 45
  },
  {
    id: "W007",
    category: "key",
    title: "新型电力系统示范项目节点推进",
    owner: "张明",
    department: "科技管理科",
    date: "2026-05-03",
    deadline: "2026-05-18",
    status: "risk",
    priority: "高",
    progress: 40
  },
  {
    id: "W008",
    category: "key",
    title: "工程质量专项检查整改",
    owner: "秦佳",
    department: "工程技术科",
    date: "2026-05-04",
    deadline: "2026-05-16",
    status: "processing",
    priority: "中",
    progress: 55
  }
];

const projects = [
  {
    id: "P001",
    name: "新能源设备智能运维平台",
    leader: "张明",
    department: "科技管理科",
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
    department: "综合办公室",
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
    department: "工程技术科",
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

const meetingRooms = [
  {
    id: "2010",
    roomId: "2010",
    name: "2010",
    capacity: 15,
    features: "电视",
    bookings: []
  },
  {
    id: "413",
    roomId: "413",
    name: "413会议室",
    capacity: 50,
    features: "投影, 白板, 视频",
    bookings: []
  },
  {
    id: "small",
    roomId: "small",
    name: "小厅",
    capacity: 10,
    features: "电视, 投影",
    bookings: []
  }
];

function getStatusMeta(status) {
  return statusMap[status] || statusMap.draft;
}

function getScope(user) {
  const capabilities = user && user.capabilities ? user.capabilities : [];
  if (capabilities.includes("global_admin")) return "global";
  if (capabilities.includes("department_admin")) return "department";
  return "self";
}

function filterByScope(list, user) {
  const scope = getScope(user);
  if (scope === "global") return list;
  if (scope === "department") {
    return list.filter((item) => item.department === user.department);
  }
  return list.filter((item) => item.owner === user.name || item.applicant === user.name || item.leader === user.name);
}

function isThisWeek(dateText) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return date >= monday && date < nextMonday;
}

function buildDashboard(user) {
  const scopedApplications = filterByScope(applications, user || {});
  const scopedTasks = filterByScope(tasks, user || {});
  const scopedProjects = filterByScope(projects, user || {});
  const scopedKeyWorks = filterByScope(workItems.filter((item) => item.category === "key"), user || {});
  const pendingApprovals = scopedApplications.filter((item) => item.approvalRequired && item.status === "pending").length;
  const activeTasks = scopedTasks.filter((item) => item.status !== "done").length;
  const riskProjects = scopedProjects.filter((item) => item.status === "risk").length;
  const todayMeetings = applications.filter((item) => item.type !== "印章").length;
  const onsiteThisWeek = workItems.filter((item) => item.category === "onsite" && isThisWeek(item.date)).length;
  const emergencyOpen = workItems.filter((item) => item.category === "emergency" && item.status !== "done").length;
  const keyOpen = scopedKeyWorks.filter((item) => item.status !== "done").length;

  return [
    { label: "待审批", value: pendingApprovals, unit: "项" },
    { label: "任务推进", value: activeTasks, unit: "项" },
    { label: "项目风险", value: riskProjects, unit: "项" },
    { label: "会议预约", value: todayMeetings, unit: "项" },
    { label: "现场工作", value: onsiteThisWeek, unit: "项" },
    { label: "应急工作", value: emergencyOpen, unit: "项" },
    { label: "重点工作", value: keyOpen, unit: "项" }
  ];
}

function decorateOnsiteItems(items) {
  return items.map((item) => ({
    ...item,
    equipmentDetails: item.equipmentDetails && item.equipmentDetails.length
      ? item.equipmentDetails
      : (equipmentTemplates[item.projectType] || [])
  }));
}

function buildTaskBoard(user) {
  return {
    normal: filterByScope(tasks, user || {}),
    onsite: decorateOnsiteItems(workItems.filter((item) => item.category === "onsite")),
    emergency: workItems.filter((item) => item.category === "emergency" && item.status !== "done"),
    key: filterByScope(workItems.filter((item) => item.category === "key" && item.status !== "done"), user || {})
  };
}

module.exports = {
  applicationTypes,
  applications,
  roles,
  departments,
  users,
  approvalFlows,
  instruments,
  equipmentTemplates,
  tasks,
  workItems,
  projects,
  roomSlots,
  meetingRooms,
  getStatusMeta,
  buildSealApprovalFlow,
  buildDashboard,
  buildTaskBoard,
  filterByScope
};
