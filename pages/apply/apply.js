const { applicationTypes, roomSlots } = require("../../utils/mock");
const { ensureAuthorized, hasCapability } = require("../../utils/auth");

const defaultForm = {
  title: "",
  time: "",
  attendees: "",
  needTencent: true,
  remark: ""
};

Page({
  data: {
    types: applicationTypes,
    activeType: "meeting",
    currentType: applicationTypes[0],
    form: { ...defaultForm },
    roomSlots,
    roomNames: ["201 综合会议室", "203 视频会议室", "305 洽谈室"],
    roomIndex: 0,
    sealTypes: ["公章", "合同章", "财务章", "法人章"],
    sealIndex: 0
  },

  onLoad(options) {
    if (!ensureAuthorized()) return;
    if (!hasCapability("apply")) {
      wx.showToast({
        title: "无申请权限",
        icon: "none"
      });
      wx.switchTab({
        url: "/pages/home/home"
      });
      return;
    }
    if (options.type) {
      this.setActiveType(options.type);
    }
  },

  switchType(event) {
    this.setActiveType(event.currentTarget.dataset.type);
  },

  setActiveType(type) {
    const currentType = applicationTypes.find((item) => item.key === type) || applicationTypes[0];
    this.setData({
      activeType: currentType.key,
      currentType
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },

  toggleTencent() {
    this.setData({
      "form.needTencent": !this.data.form.needTencent
    });
  },

  onRoomChange(event) {
    this.setData({
      roomIndex: Number(event.detail.value)
    });
  },

  onSealChange(event) {
    this.setData({
      sealIndex: Number(event.detail.value)
    });
  },

  submitApply() {
    if (!this.data.form.title || !this.data.form.time) {
      wx.showToast({
        title: "请填写主题和时间",
        icon: "none"
      });
      return;
    }

    wx.showToast({
      title: "申请已提交",
      icon: "success"
    });
    this.setData({
      form: { ...defaultForm }
    });
  }
});
