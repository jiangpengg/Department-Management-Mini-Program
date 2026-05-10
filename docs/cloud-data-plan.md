# 小程序云端数据整理

这个小程序是多人共用的管理工具，原则是：共享业务数据上云，本地缓存只做界面状态、草稿和断网兜底。

## 已上云的数据

- 组织架构：`admin_configs.orgConfig`
  - 科室列表
  - 人员列表
  - 基础角色列表
- 管理配置：`admin_configs`
  - `riskLevelPeople`：风险等级对应人员
  - `compositeRoles`：综合角色人员配置
  - `onsiteProjectConfigs`：现场工作试验项目和仪器清单
  - `projectProgress`：科技项目进度数据
- 会议申请：`meeting_records`
  - 腾讯会议创建结果
  - 申请人、日期、时间、账号、链接
- 会议室：`meeting_rooms`、`room_bookings`
- 印章申请：`seal_applications`
- 现场工作：`onsite_works`
- 仪器流转：`instrument_flows`

## 本地只保留的数据

- 当前页面筛选条件，例如任务分类、全部/我的、本周/下周。
- 正在填写但还没提交的表单内容。
- 云函数不可用时的临时兜底缓存，例如 `orgConfigCache`、`onsiteWorks`、`instrumentFlow`。
- 调试账号切换配置，目前在 `app.js` 里，正式上线前应改为按微信 openid 登录匹配云端人员。

## 后续建议

- 给 `admin_configs.orgConfig` 增加管理页面里的“编辑姓名/科室名称/角色名称”能力。
- 给 `projectProgress` 增加项目新增、节点更新、进度更新页面。
- 正式上线前把 `app.js` 的固定调试用户替换成 `login` 云函数返回的 openid，再从 `orgConfig.users` 查授权人员。
