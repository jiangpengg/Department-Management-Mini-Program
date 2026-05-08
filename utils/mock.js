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
    desc: "线上会议、参会人、会议链接需求登记",
    icon: "会"
  },
  {
    key: "room",
    name: "会议室申请",
    desc: "会议室预约、时间冲突检查、使用记录",
    icon: "室"
  },
  {
    key: "seal",
    name: "印章申请",
    desc: "用章类型、材料附件、审批留痕",
    icon: "章"
  }
];

const applications = [
  {
    id: "A20260501001",
    type: "腾讯会议",
    title: "省级科技项目启动会",
    applicant: "刘洋",
    time: "2026-05-06 09:30",
    status: "pending",
    detail: "申请创建腾讯会议，预计 18 人参会。"
  },
  {
    id: "A20260501002",
    type: "会议室",
    title: "二楼 203 会议室",
    applicant: "周倩",
    time: "2026-05-07 14:00",
    status: "approved",
    detail: "项目评审会，需投影和视频设备。"
  },
  {
    id: "A20260430009",
    type: "印章",
    title: "合作协议用章",
    applicant: "陈宁",
    time: "2026-05-08 10:00",
    status: "pending",
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
  const pendingApprovals = applications.filter((item) => item.status === "pending").length;
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
  tasks,
  projects,
  roomSlots,
  getStatusMeta,
  buildDashboard
};
