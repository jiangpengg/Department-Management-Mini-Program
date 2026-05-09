Component({
  data: {
    hidden: false,
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/home",
        text: "工作台",
        icon: "⌂"
      },
      {
        pagePath: "/pages/approval/approval",
        text: "审批",
        icon: "✓"
      },
      {
        pagePath: "/pages/tasks/tasks",
        text: "任务",
        icon: "□"
      },
      {
        pagePath: "/pages/projects/projects",
        text: "项目",
        icon: "◇"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "○"
      }
    ]
  },

  methods: {
    switchTab(event) {
      const path = event.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    }
  }
});
