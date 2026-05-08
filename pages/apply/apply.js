const { applicationTypes, roomSlots } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, hasCapability } = require("../../utils/auth");

const defaultForm = {
  title: "",
  time: "",
  meetingDate: "",
  meetingStartTime: "",
  meetingEndTime: "",
  duration: "2",
  needTencent: true,
  remark: ""
};

const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatHour(hour) {
  return `${pad(hour)}:00`;
}

Page({
  data: {
    types: applicationTypes,
    activeType: "meeting",
    currentType: applicationTypes[0],
    form: { ...defaultForm },
    todayDate: "",
    meetingTimeText: "点击选择时间段",
    pickerPanelVisible: false,
    pickerPanelType: "",
    pickerPanelTitle: "",
    weekdays,
    calendarTitle: "",
    calendarYear: 0,
    calendarMonth: 0,
    calendarDays: [],
    pendingMeetingDate: "",
    pendingMeetingDateText: "",
    pendingStartHour: 9,
    pendingEndHour: 11,
    pendingStartTime: "09:00",
    pendingEndTime: "11:00",
    pendingDurationHours: 2,
    pendingChoosingEnd: false,
    draggingTime: false,
    selectingStartGesture: false,
    timeSlots: [],
    roomSlots,
    roomNames: ["201 综合会议室", "203 视频会议室", "305 洽谈室"],
    roomIndex: 0,
    sealTypes: ["公章", "合同章", "财务章", "法人章"],
    sealIndex: 0,
    meetingResult: null,
    meetingRecords: [],
    submitting: false
  },

  onLoad(options) {
    if (!ensureAuthorized()) return;
    this.initPickerDefaults();
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
    this.loadMeetingRecords();
  },

  onShow() {
    if (this.data.activeType === "meeting") {
      this.loadMeetingRecords();
    }
  },

  initPickerDefaults() {
    const now = new Date();
    const todayDate = formatDate(now);
    const dateText = this.formatDateText(todayDate);
    this.setData({
      todayDate,
      calendarYear: now.getFullYear(),
      calendarMonth: now.getMonth(),
      pendingMeetingDate: todayDate,
      pendingMeetingDateText: dateText,
      "form.meetingDate": todayDate,
      "form.meetingStartTime": "09:00",
      "form.meetingEndTime": "11:00",
      "form.duration": "2"
    }, () => {
      this.buildCalendar();
      this.updateTimeSlots();
      this.updateMeetingTimeText();
    });
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

  openDatePanel() {
    const date = this.parseDate(this.data.form.meetingDate || this.data.todayDate);
    this.setData({
      pickerPanelVisible: true,
      pickerPanelType: "date",
      pickerPanelTitle: "选择会议日期",
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth(),
      pendingMeetingDate: formatDate(date),
      pendingMeetingDateText: this.formatDateText(formatDate(date))
    }, () => {
      this.buildCalendar();
    });
  },

  openTimePanel() {
    const startHour = this.parseHour(this.data.form.meetingStartTime, 9);
    const endHour = this.parseHour(this.data.form.meetingEndTime, Math.min(startHour + 2, 20));
    this.setData({
      pickerPanelVisible: true,
      pickerPanelType: "time",
      pickerPanelTitle: "选择会议时间",
      pendingMeetingDate: this.data.form.meetingDate || this.data.todayDate,
      pendingMeetingDateText: this.formatDateText(this.data.form.meetingDate || this.data.todayDate),
      pendingStartHour: startHour,
      pendingEndHour: Math.max(startHour + 1, endHour),
      pendingChoosingEnd: false
    }, () => {
      this.updateTimeSlots();
    });
  },

  prevCalendarMonth() {
    const date = new Date(this.data.calendarYear, this.data.calendarMonth - 1, 1);
    this.setData({
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth()
    }, () => {
      this.buildCalendar();
    });
  },

  nextCalendarMonth() {
    const date = new Date(this.data.calendarYear, this.data.calendarMonth + 1, 1);
    this.setData({
      calendarYear: date.getFullYear(),
      calendarMonth: date.getMonth()
    }, () => {
      this.buildCalendar();
    });
  },

  selectCalendarDay(event) {
    const value = event.currentTarget.dataset.date;
    if (value < this.data.todayDate) return;
    this.setData({
      pendingMeetingDate: value,
      pendingMeetingDateText: this.formatDateText(value)
    }, () => {
      this.buildCalendar();
    });
  },

  startTimeDrag(event) {
    this.resolveTimelineHour(event.touches[0].clientY, (hour) => {
      if (!this.data.pendingChoosingEnd) {
        this.setData({
          draggingTime: false,
          selectingStartGesture: true,
          pendingChoosingEnd: true,
          pendingStartHour: hour,
          pendingEndHour: Math.min(hour + 1, 21)
        }, () => {
          this.updateTimeSlots();
        });
        return;
      }

      const endHour = this.resolveEndHour(hour, this.data.pendingStartHour);
      this.setData({
        draggingTime: true,
        selectingStartGesture: false,
        pendingEndHour: endHour
      }, () => {
        this.updateTimeSlots();
      });
    });
  },

  moveTimeDrag(event) {
    if (!this.data.draggingTime) return;
    this.resolveTimelineHour(event.touches[0].clientY, (hour) => {
      const startHour = this.data.pendingStartHour;
      const endHour = this.resolveEndHour(hour, startHour);
      this.setData({
        pendingEndHour: endHour
      }, () => {
        this.updateTimeSlots();
      });
    });
  },

  endTimeDrag() {
    if (this.data.selectingStartGesture) {
      this.setData({
        selectingStartGesture: false,
        draggingTime: false
      });
      return;
    }

    this.setData({
      draggingTime: false,
      pendingChoosingEnd: false
    });
  },

  resolveEndHour(touchedHour, startHour) {
    if (touchedHour <= startHour) {
      return Math.min(startHour + 1, 21);
    }
    return Math.min(touchedHour, startHour + 6, 21);
  },

  resolveTimelineHour(clientY, callback) {
    wx.createSelectorQuery()
      .in(this)
      .selectAll(".timeline-row")
      .boundingClientRect((rects) => {
        if (!rects || !rects.length) return;
        let index = rects.findIndex((rect) => clientY >= rect.top && clientY <= rect.bottom);

        if (index < 0) {
          index = rects.reduce((bestIndex, rect, currentIndex) => {
            const bestRect = rects[bestIndex];
            const bestDistance = Math.min(Math.abs(clientY - bestRect.top), Math.abs(clientY - bestRect.bottom));
            const currentDistance = Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom));
            return currentDistance < bestDistance ? currentIndex : bestIndex;
          }, 0);
        }

        const slot = this.data.timeSlots[index];
        if (slot) {
          callback(slot.hour);
        }
      })
      .exec();
  },

  closePickerPanel() {
    this.setData({
      pickerPanelVisible: false
    });
  },

  noop() {},

  confirmPickerPanel() {
    if (this.data.pickerPanelType === "date") {
      this.setData({
        "form.meetingDate": this.data.pendingMeetingDate,
        pendingMeetingDateText: this.formatDateText(this.data.pendingMeetingDate)
      }, () => {
        this.updateMeetingTimeText();
      });
    }

    if (this.data.pickerPanelType === "time") {
      const duration = this.data.pendingEndHour - this.data.pendingStartHour;
      this.setData({
        "form.meetingStartTime": formatHour(this.data.pendingStartHour),
        "form.meetingEndTime": formatHour(this.data.pendingEndHour),
        "form.duration": String(duration)
      }, () => {
        this.updateMeetingTimeText();
      });
    }

    this.closePickerPanel();
  },

  buildCalendar() {
    const year = this.data.calendarYear;
    const month = this.data.calendarMonth;
    const today = this.data.todayDate;
    const firstDay = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstDay.getDay());
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const value = formatDate(date);
      return {
        key: `${value}-${index}`,
        value,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        disabled: value < today
      };
    });

    this.setData({
      calendarTitle: `${year}年${month + 1}月`,
      calendarDays: days
    });
  },

  updateTimeSlots() {
    const startHour = this.data.pendingStartHour;
    const endHour = this.data.pendingEndHour;
    const duration = endHour - startHour;
    const slots = Array.from({ length: 14 }, (_, index) => {
      const hour = index + 7;
      return {
        hour,
        label: formatHour(hour),
        selected: hour >= startHour && hour < endHour,
        start: hour === startHour,
        end: hour === endHour - 1
      };
    });

    this.setData({
      pendingStartTime: formatHour(startHour),
      pendingEndTime: formatHour(endHour),
      pendingDurationHours: duration,
      timeSlots: slots
    });
  },

  updateMeetingTimeText() {
    const date = this.data.form.meetingDate;
    const startTime = this.data.form.meetingStartTime;
    const endTime = this.data.form.meetingEndTime;
    const duration = this.data.form.duration;
    const text = date && startTime && endTime
      ? `${startTime} - ${endTime}（${duration}小时）`
      : "点击选择时间段";
    this.setData({
      meetingTimeText: text
    });
  },

  parseDate(value) {
    const parts = (value || this.data.todayDate).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  },

  parseHour(value, fallback) {
    const hour = Number((value || "").split(":")[0]);
    return Number.isFinite(hour) ? hour : fallback;
  },

  formatDateText(value) {
    const date = this.parseDate(value);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekNames[date.getDay()]}`;
  },

  async submitApply() {
    if (!this.data.form.title) {
      wx.showToast({
        title: "请填写主题",
        icon: "none"
      });
      return;
    }

    if (this.data.activeType === "meeting" && this.data.form.needTencent) {
      if (!this.data.form.meetingDate || !this.data.form.meetingStartTime || !this.data.form.meetingEndTime) {
        wx.showToast({
          title: "请选择会议时间",
          icon: "none"
        });
        return;
      }

      await this.createTencentMeeting();
      return;
    }

    wx.showToast({
      title: this.data.currentType.approvalRequired ? "已提交审批" : "已登记",
      icon: "success"
    });
    this.setData({
      form: { ...defaultForm }
    });
  },

  createTencentMeeting() {
    if (!wx.cloud) {
      wx.showToast({
        title: "云开发未初始化",
        icon: "none"
      });
      return Promise.resolve();
    }

    this.setData({
      submitting: true,
      meetingResult: null
    });

    return wx.cloud.callFunction({
      name: "createTencentMeeting",
      data: {
        title: this.data.form.title,
        startTime: this.buildMeetingStartTime(),
        endTime: this.buildMeetingEndTime(),
        applicant: getCurrentUser().name,
        applicantId: getCurrentUser().id,
        applicantOpenid: getCurrentUser().openid
      }
    }).then((res) => {
      const result = res.result || {};
      if (result.ok) {
        result.display = {
          title: this.data.form.title,
          applicant: getCurrentUser().name,
          dateText: this.formatDateText(this.data.form.meetingDate),
          timeText: `${this.data.form.meetingStartTime} - ${this.data.form.meetingEndTime}`
        };
        result.copyText = this.buildMeetingInfoText({
          title: result.display.title,
          applicant: result.display.applicant,
          dateText: result.display.dateText,
          timeText: result.display.timeText,
          account: result.meeting && result.meeting.account,
          meeting: result.meeting
        });
      }
      this.setData({
        submitting: false,
        meetingResult: result
      });
      wx.showToast({
        title: result.ok ? "会议已创建" : "创建失败",
        icon: result.ok ? "success" : "none"
      });
      if (result.ok) {
        this.setData({
          form: { ...defaultForm }
        }, () => {
          this.initPickerDefaults();
          this.loadMeetingRecords();
        });
      }
    }).catch((error) => {
      this.setData({
        submitting: false,
        meetingResult: {
          ok: false,
          message: error.errMsg || "云函数调用失败"
        }
      });
      wx.showToast({
        title: "创建失败",
        icon: "none"
      });
    });
  },

  loadMeetingRecords() {
    if (!wx.cloud) return;
    wx.cloud.callFunction({
      name: "listMeetingRecords"
    }).then((res) => {
      const result = res.result || {};
      if (result.ok) {
        this.setData({
          meetingRecords: (result.records || []).map((record) => ({
            ...record,
            dateText: this.formatRecordDate(record),
            timeText: this.formatRecordTime(record),
            accountText: record.account || (record.meeting && record.meeting.account) || "",
            canDelete: this.canDeleteRecord(record),
            copyText: this.buildMeetingInfoText({
              title: record.title,
              applicant: record.applicant,
              dateText: this.formatRecordDate(record),
              timeText: this.formatRecordTime(record),
              account: record.account || (record.meeting && record.meeting.account) || "",
              meeting: record.meeting
            })
          }))
        });
      }
    }).catch(() => {});
  },

  copyMeetingInfo() {
    const text = this.data.meetingResult && this.data.meetingResult.copyText;
    if (!text) {
      wx.showToast({
        title: "暂无会议信息",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({
          title: "信息已复制",
          icon: "success"
        });
      }
    });
  },

  copyRecordInfo(event) {
    const record = this.data.meetingRecords[Number(event.currentTarget.dataset.index)];
    if (!record || !record.copyText) {
      wx.showToast({
        title: "暂无会议信息",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: record.copyText,
      success() {
        wx.showToast({
          title: "信息已复制",
          icon: "success"
        });
      }
    });
  },

  deleteRecord(event) {
    const record = this.data.meetingRecords[Number(event.currentTarget.dataset.index)];
    if (!record || !record._id) return;
    const user = getCurrentUser();

    wx.showModal({
      title: "删除会议",
      content: "确定取消这场腾讯会议并删除申请记录吗？",
      confirmText: "删除会议",
      confirmColor: "#c0392b",
      success: (modalResult) => {
        if (!modalResult.confirm) return;
        wx.cloud.callFunction({
          name: "deleteMeetingRecord",
          data: {
            recordId: record._id,
            applicant: user.name,
            applicantId: user.id,
            applicantOpenid: user.openid
          }
        }).then((res) => {
          const result = res.result || {};
          wx.showToast({
            title: result.ok ? "会议已删除" : (result.message || "删除失败"),
            icon: result.ok ? "success" : "none"
          });
          if (result.ok) {
            this.loadMeetingRecords();
          }
        }).catch((error) => {
          wx.showToast({
            title: error.errMsg || "删除失败",
            icon: "none"
          });
        });
      }
    });
  },

  buildMeetingStartTime() {
    return `${this.data.form.meetingDate}T${this.data.form.meetingStartTime}:00+08:00`;
  },

  buildMeetingEndTime() {
    return `${this.data.form.meetingDate}T${this.data.form.meetingEndTime}:00+08:00`;
  },

  formatRecordTime(record) {
    const start = record.startTime || (record.meeting && record.meeting.startTime) || "";
    const end = record.endTime || (record.meeting && record.meeting.endTime) || "";
    return `${this.formatIsoTime(start)} - ${this.formatIsoTime(end)}`;
  },

  formatRecordDate(record) {
    const start = record.startTime || (record.meeting && record.meeting.startTime) || "";
    const date = String(start).slice(0, 10);
    return date ? this.formatDateText(date) : "";
  },

  formatIsoTime(value) {
    const match = String(value).match(/T(\d{2}:\d{2})/);
    return match ? match[1] : value;
  },

  canDeleteRecord(record) {
    const user = getCurrentUser();
    return Boolean(
      (record.applicantId && user.id && record.applicantId === user.id) ||
      (record.applicantOpenid && user.openid && record.applicantOpenid === user.openid) ||
      (!record.applicantId && !record.applicantOpenid && record.applicant && record.applicant === user.name)
    );
  },

  buildMeetingInfoText({ title, applicant, dateText, timeText, account, meeting }) {
    return [
      `主题：${title || ""}`,
      `申请人：${applicant || ""}`,
      `会议时间：${dateText || ""} ${timeText || ""}`,
      `会议号：${meeting && meeting.meetingCode ? meeting.meetingCode : ""}`,
      `会议链接：${meeting && meeting.joinUrl ? meeting.joinUrl : ""}`
    ].join("\n");
  }
});
