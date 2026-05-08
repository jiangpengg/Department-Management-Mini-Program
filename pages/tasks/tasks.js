const { tasks, getStatusMeta } = require("../../utils/mock");

function decorate(list) {
  return list.map((item) => {
    const meta = getStatusMeta(item.status);
    return { ...item, statusText: meta.text, statusTone: meta.tone };
  });
}

Page({
  data: {
    tasks: []
  },

  onLoad() {
    this.setData({
      tasks: decorate(tasks)
    });
  },

  createTask() {
    wx.showToast({
      title: "后续接入创建任务表单",
      icon: "none"
    });
  },

  finishTask(event) {
    const nextList = this.data.tasks.map((item) => {
      if (item.id !== event.currentTarget.dataset.id) return item;
      const meta = getStatusMeta("done");
      return { ...item, status: "done", progress: 100, statusText: meta.text, statusTone: meta.tone };
    });
    this.setData({ tasks: nextList });
  }
});
