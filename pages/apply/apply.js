const { applicationTypes, roomSlots, meetingRooms, instruments, buildSealApprovalFlow, buildTaskBoard } = require("../../utils/mock");
const { ensureAuthorized, getCurrentUser, hasCapability } = require("../../utils/auth");

const defaultForm = {
  title: "",
  time: "",
  meetingDate: "",
  meetingStartTime: "",
  meetingEndTime: "",
  duration: "2",
  needTencent: true,
  sealPhotoPath: "",
  remark: ""
};

const weekNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const roomTimelineLabels = ["8", "10", "12", "14", "16", "18", "20", "22"];
const roomTimelineStart = 8;
const roomTimelineEnd = 23;
const roomTimelineTotal = roomTimelineEnd - roomTimelineStart;
const defaultMeetingRooms = meetingRooms;

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
    roomTimelineLabels,
    roomTimelineRooms: [],
    meetingRooms: [],
    roomLoading: false,
    roomSelectedDateText: "今天",
    selectedRoomIndex: -1,
    roomSelectedName: "",
    sealTypes: ["公章", "合同章", "财务章", "法人章"],
    sealIndex: 0,
    instruments,
    instrumentNames: instruments.map((item) => `${item.name}（可用${item.available}${item.unit}）`),
    instrumentIndex: 0,
    instrumentQuantity: "1",
    instrumentPurpose: "",
    instrumentFlow: [],
    startedOnsiteTasks: [],
    startedTaskNames: [],
    startedTaskIndex: 0,
    selectedTaskEquipment: [],
    meetingResult: null,
    meetingRecords: [],
    roomBookingRecords: [],
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
    this.loadMeetingRooms();
    this.loadInstrumentFlow();
  },

  onShow() {
    if (this.data.activeType === "meeting") {
      this.loadMeetingRecords();
    }
    if (this.data.activeType === "room") {
      this.loadMeetingRooms();
    }
    if (this.data.activeType === "instrument" || this.data.activeType === "return") {
      this.loadStartedOnsiteTasks();
      this.loadInstrumentFlow();
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
      this.updateRoomDateText(todayDate);
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
    }, () => {
      if (currentType.key === "room") {
        this.updateRoomDateText(this.data.form.meetingDate || this.data.todayDate);
        this.loadMeetingRooms();
      }
      if (currentType.key === "instrument" || currentType.key === "return") {
        this.loadStartedOnsiteTasks();
      }
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

  openRoomDatePanel() {
    this.openDatePanel();
  },

  openRoomTimePanel(event) {
    const index = Number(event.currentTarget.dataset.index);
    const room = this.data.roomTimelineRooms[index];
    if (!room) return;
    const startHour = this.parseHour(this.data.form.meetingStartTime, 9);
    const endHour = this.parseHour(this.data.form.meetingEndTime, Math.min(startHour + 2, 20));
    this.setData({
      selectedRoomIndex: index,
      roomIndex: Math.max(0, this.data.roomNames.indexOf(room.name)),
      roomSelectedName: room.name,
      pickerPanelVisible: true,
      pickerPanelType: "time",
      pickerPanelTitle: `${room.name} 选择时间`,
      pendingMeetingDate: this.data.form.meetingDate || this.data.todayDate,
      pendingMeetingDateText: this.formatDateText(this.data.form.meetingDate || this.data.todayDate),
      pendingStartHour: startHour,
      pendingEndHour: Math.max(startHour + 1, endHour),
      pendingChoosingEnd: false
    }, () => {
      this.updateTimeSlots();
    });
  },

  onSealChange(event) {
    this.setData({
      sealIndex: Number(event.detail.value)
    });
  },

  chooseSealPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        this.setData({
          "form.sealPhotoPath": file.tempFilePath
        });
      }
    });
  },

  previewSealPhoto() {
    if (!this.data.form.sealPhotoPath) return;
    wx.previewImage({
      urls: [this.data.form.sealPhotoPath],
      current: this.data.form.sealPhotoPath
    });
  },

  removeSealPhoto() {
    this.setData({
      "form.sealPhotoPath": ""
    });
  },

  onInstrumentChange(event) {
    this.setData({
      instrumentIndex: Number(event.detail.value)
    });
  },

  onInstrumentQuantityInput(event) {
    this.setData({
      instrumentQuantity: event.detail.value
    });
  },

  onInstrumentPurposeInput(event) {
    this.setData({
      instrumentPurpose: event.detail.value
    });
  },

  async loadStartedOnsiteTasks() {
    const user = getCurrentUser();
    const board = buildTaskBoard(user);
    const mockOnsite = board.onsite || [];
    const cloudOnsite = await this.loadCloudOnsiteWorks();
    const localOnsite = cloudOnsite.length ? [] : (wx.getStorageSync("onsiteWorks") || []);
    const flow = await this.loadInstrumentFlowRecords();
    const borrowedTaskIds = flow
      .filter((record) => record.type === "出库申请" && record.status === "已出库")
      .map((record) => record.taskId);
    const taskMap = {};
    mockOnsite.concat(localOnsite).forEach((item) => {
      taskMap[item.id] = item;
    });
    const started = Object.keys(taskMap)
      .map((id) => taskMap[id])
      .filter((item) => {
        const hasEquipment = item.status === "processing" && item.equipmentDetails && item.equipmentDetails.length;
        if (this.data.activeType === "return") {
          return hasEquipment && borrowedTaskIds.indexOf(item.id) >= 0;
        }
        return hasEquipment;
      });
    const selected = started[0] || null;
    const selectedEquipment = this.buildSelectedTaskEquipment(selected, flow);
    this.setData({
      startedOnsiteTasks: started,
      startedTaskNames: started.map((item) => `${item.title}（负责人：${item.owner}）`),
      startedTaskIndex: 0,
      selectedTaskEquipment: selectedEquipment
    });
  },

  onStartedTaskChange(event) {
    const index = Number(event.detail.value);
    const task = this.data.startedOnsiteTasks[index];
    const flow = this.data.instrumentFlow || [];
    this.setData({
      startedTaskIndex: index,
      selectedTaskEquipment: this.buildSelectedTaskEquipment(task, flow)
    });
  },

  async loadCloudOnsiteWorks() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listOnsiteWorks"
      });
      const result = res.result || {};
      return result.ok ? (result.records || []) : [];
    } catch (error) {
      return [];
    }
  },

  buildSelectedTaskEquipment(task, flow) {
    if (!task) return [];
    if (this.data.activeType === "return") {
      const borrowed = (flow || []).find((record) => record.taskId === task.id && record.type === "出库申请" && record.status === "已出库");
      if (borrowed && borrowed.equipmentDetails && borrowed.equipmentDetails.length) {
        return borrowed.equipmentDetails.map((item) => ({ ...item, checked: false }));
      }
    }
    return (task.equipmentDetails || []).map((item) => ({ ...item, checked: false }));
  },

  async loadInstrumentFlow() {
    const flow = await this.loadInstrumentFlowRecords();
    this.setInstrumentFlowData(flow);
  },

  async loadInstrumentFlowRecords() {
    if (!wx.cloud) return wx.getStorageSync("instrumentFlow") || [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listInstrumentFlows"
      });
      const result = res.result || {};
      return result.ok ? (result.records || []) : (wx.getStorageSync("instrumentFlow") || []);
    } catch (error) {
      return wx.getStorageSync("instrumentFlow") || [];
    }
  },

  setInstrumentFlowData(flow) {
    const canConfirm = this.canConfirmInventory();
    this.setData({
      instrumentFlow: flow.map((record) => ({
        ...record,
        canConfirm: canConfirm && record.status === "待仓库管理员确认"
      }))
    });
  },

  canConfirmInventory() {
    return hasCapability("global_admin") || hasCapability("system_config");
  },

  saveInstrumentFlow(flow) {
    wx.setStorageSync("instrumentFlow", flow);
    this.setInstrumentFlowData(flow);
  },

  async confirmInventoryRecord(event) {
    const id = event.currentTarget.dataset.id;
    const flow = this.data.instrumentFlow || [];
    const current = flow.find((record) => record.id === id || record._id === id);
    const nextFlow = flow.map((record) => {
      if (record.id !== id && record._id !== id) return record;
      return {
        ...record,
        status: record.type === "归还申请" ? "已入库" : "已出库",
        confirmedBy: getCurrentUser().name
      };
    });
    const record = nextFlow.find((item) => item.id === id || item._id === id);
    if (current && current._id) {
      const ok = await this.updateCloudInstrumentFlow(current._id, {
        status: record.status,
        confirmedBy: getCurrentUser().name
      });
      if (!ok) {
        wx.showToast({ title: "云端确认失败", icon: "none" });
        return;
      }
    }
    if (record && record.type === "归还申请") {
      await this.closeOnsiteTask(record.taskId);
    }
    if (current && current._id) {
      this.setInstrumentFlowData(nextFlow);
    } else {
      this.saveInstrumentFlow(nextFlow);
    }
    this.loadStartedOnsiteTasks();
    wx.showToast({
      title: record && record.type === "归还申请" ? "已确认入库" : "已确认出库",
      icon: "success"
    });
  },

  async closeOnsiteTask(taskId) {
    const cloudOnsite = await this.loadCloudOnsiteWorks();
    const cloudTask = cloudOnsite.find((item) => item.id === taskId);
    if (cloudTask && cloudTask._id) {
      await wx.cloud.callFunction({
        name: "updateOnsiteWork",
        data: {
          recordId: cloudTask._id,
          data: {
            status: "done",
            progress: 100
          }
        }
      }).catch(() => {});
      return;
    }
    const localOnsite = wx.getStorageSync("onsiteWorks") || [];
    wx.setStorageSync("onsiteWorks", localOnsite.map((item) => (
      item.id === taskId ? { ...item, status: "done", progress: 100 } : item
    )));
    const closedTaskIds = wx.getStorageSync("closedOnsiteTaskIds") || [];
    if (closedTaskIds.indexOf(taskId) < 0) {
      wx.setStorageSync("closedOnsiteTaskIds", [taskId, ...closedTaskIds]);
    }
  },

  async updateCloudInstrumentFlow(recordId, data) {
    if (!wx.cloud || !recordId) return false;
    try {
      const res = await wx.cloud.callFunction({
        name: "updateInstrumentFlow",
        data: {
          recordId,
          data
        }
      });
      const result = res.result || {};
      return Boolean(result.ok);
    } catch (error) {
      return false;
    }
  },

  toggleEquipmentCheck(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      selectedTaskEquipment: this.data.selectedTaskEquipment.map((item, itemIndex) => (
        itemIndex === index ? { ...item, checked: !item.checked } : item
      ))
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

  async confirmPickerPanel() {
    if (this.data.pickerPanelType === "date") {
      this.setData({
        "form.meetingDate": this.data.pendingMeetingDate,
        pendingMeetingDateText: this.formatDateText(this.data.pendingMeetingDate)
      }, () => {
        this.updateMeetingTimeText();
        this.updateRoomDateText(this.data.pendingMeetingDate);
        this.loadRoomBookings();
      });
    }

    if (this.data.pickerPanelType === "time") {
      const duration = this.data.pendingEndHour - this.data.pendingStartHour;
      const startTime = formatHour(this.data.pendingStartHour);
      const endTime = formatHour(this.data.pendingEndHour);
      const nextData = {
        "form.meetingStartTime": formatHour(this.data.pendingStartHour),
        "form.meetingEndTime": formatHour(this.data.pendingEndHour),
        "form.duration": String(duration)
      };
      if (this.data.activeType === "room") {
        nextData["form.time"] = `${this.data.form.meetingDate || this.data.pendingMeetingDate} ${startTime}-${endTime}`;
        nextData["form.title"] = this.data.form.title || `${this.data.roomSelectedName}预约`;
        const reserved = await this.reserveSelectedRoom(this.data.pendingStartHour, this.data.pendingEndHour);
        if (!reserved) return;
      }
      this.setData(nextData, () => {
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

  buildRoomTimeline() {
    const selectedDate = this.data.form.meetingDate || this.data.todayDate;
    const bookingRecords = this.data.roomBookingRecords || [];
    const rooms = (this.data.meetingRooms || []).map((room) => {
      const sharedBookings = bookingRecords
        .filter((booking) => booking.roomId === room.id && booking.date === selectedDate)
        .map((booking) => ({
          start: booking.startHour,
          end: booking.endHour,
          title: booking.title,
          applicant: booking.applicant
        }));
      return {
      ...room,
      segments: Array.from({ length: roomTimelineTotal }, (_, index) => ({ id: `${room.id}-${index}` })),
        bookings: room.bookings.concat(sharedBookings).map((booking) => ({
        ...booking,
        left: this.getTimelineLeft(booking.start),
        width: this.getTimelineWidth(booking.start, booking.end)
      }))
      };
    });
    this.setData({
      roomTimelineRooms: rooms
    });
  },

  async reserveSelectedRoom(start, end) {
    const index = this.data.selectedRoomIndex;
    const room = this.data.roomTimelineRooms[index];
    if (index < 0 || !room) return false;
    if (!wx.cloud) {
      wx.showToast({
        title: "云开发未初始化",
        icon: "none"
      });
      return false;
    }

    this.setData({ submitting: true });
    try {
      const user = getCurrentUser();
      const res = await wx.cloud.callFunction({
        name: "createRoomBooking",
        data: {
          roomId: room.id,
          roomName: room.name,
          date: this.data.form.meetingDate || this.data.pendingMeetingDate,
          startHour: start,
          endHour: end,
          startTime: formatHour(start),
          endTime: formatHour(end),
          title: this.data.form.title || `${room.name}预约`,
          applicant: user.name,
          applicantId: user.id,
          applicantOpenid: user.openid
        }
      });
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({
          title: result.message || "该时间已被占用",
          icon: "none"
        });
        this.setData({ submitting: false });
        await this.loadRoomBookings();
        return false;
      }

      wx.showToast({
        title: "会议室已占用",
        icon: "success"
      });
      this.setData({
        submitting: false,
        selectedRoomIndex: -1
      });
      await this.loadRoomBookings();
      return true;
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({
        title: error.errMsg || "占用失败",
        icon: "none"
      });
      return false;
    }
  },

  updateRoomDateText(value) {
    const text = value === this.data.todayDate ? "今天" : this.formatDateText(value);
    this.setData({
      roomSelectedDateText: text
    });
  },

  getTimelineLeft(hour) {
    return Math.max(0, Math.min(100, ((hour - roomTimelineStart) / roomTimelineTotal) * 100));
  },

  getTimelineWidth(start, end) {
    return Math.max(0, Math.min(100, ((end - start) / roomTimelineTotal) * 100));
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
    if (this.data.activeType === "instrument" || this.data.activeType === "return") {
      const task = this.data.startedOnsiteTasks[this.data.startedTaskIndex];
      const checkedEquipment = this.data.selectedTaskEquipment.filter((item) => item.checked);
      if (!task) {
        wx.showToast({ title: "请选择已启动任务", icon: "none" });
        return;
      }
      if (!checkedEquipment.length) {
        wx.showToast({ title: "请确认设备明细", icon: "none" });
        return;
      }
      const record = {
        id: `${this.data.activeType === "instrument" ? "OUT" : "IN"}-${Date.now()}`,
        type: this.data.activeType === "instrument" ? "出库申请" : "归还申请",
        taskId: task.id,
        taskTitle: task.title,
        instrumentName: checkedEquipment.map((item) => `${item.name}×${item.quantity}`).join("、"),
        equipmentDetails: checkedEquipment,
        quantity: checkedEquipment.reduce((total, item) => total + Number(item.quantity || 1), 0),
        purpose: task.title,
        borrower: getCurrentUser().name,
        time: this.data.todayDate,
        status: "待仓库管理员确认"
      };
      const cloudId = await this.createCloudInstrumentFlow(record);
      const savedRecord = cloudId ? { ...record, _id: cloudId } : record;
      const nextFlow = [savedRecord, ...(this.data.instrumentFlow || [])];
      if (cloudId) {
        this.setInstrumentFlowData(nextFlow);
      } else {
        this.saveInstrumentFlow(nextFlow);
      }
      this.setData({
        selectedTaskEquipment: this.data.selectedTaskEquipment.map((item) => ({ ...item, checked: false })),
        form: { ...defaultForm }
      });
      wx.showToast({ title: this.data.activeType === "instrument" ? "已提交出库申请" : "已提交归还申请", icon: "success" });
      return;
    }

    if (!this.data.form.title) {
      wx.showToast({
        title: "请填写主题",
        icon: "none"
      });
      return;
    }

    if (this.data.activeType === "seal") {
      if (!this.data.form.sealPhotoPath) {
        wx.showToast({
          title: "请上传盖章文件照片",
          icon: "none"
        });
        return;
      }
      const user = getCurrentUser();
      const flow = buildSealApprovalFlow(user);
      await this.saveSealApplication(user, flow);
      wx.showModal({
        title: "用印申请流程",
        content: flow.map((step, index) => `${index + 1}. ${step.name}`).join("\n"),
        showCancel: false,
        confirmText: "知道了"
      });
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

  async saveSealApplication(user, flow) {
    let record = {
      id: `SEAL-${Date.now()}`,
      type: "印章",
      title: this.data.form.title,
      time: this.data.todayDate,
      detail: "盖章文件照片已上传留底。",
      sealPhotoPath: this.data.form.sealPhotoPath,
      approvalFlow: flow
    };
    if (!wx.cloud) {
      this.saveLocalSealApplication(user, flow, record);
      return;
    }
    try {
      const cloudPhotoPath = await this.uploadSealPhoto(record.sealPhotoPath);
      record = {
        ...record,
        sealPhotoPath: cloudPhotoPath
      };
      const res = await wx.cloud.callFunction({
        name: "createSealApplication",
        data: {
          user,
          application: record
        }
      });
      const result = res.result || {};
      if (!result.ok) {
        this.saveLocalSealApplication(user, flow, record);
        wx.showToast({
          title: result.message || "云端保存失败，已本地暂存",
          icon: "none"
        });
      }
    } catch (error) {
      this.saveLocalSealApplication(user, flow, record);
      wx.showToast({
        title: "云端不可用，已本地暂存",
        icon: "none"
      });
    }
  },

  async uploadSealPhoto(filePath) {
    if (!filePath || String(filePath).indexOf("cloud://") === 0) return filePath;
    const suffixMatch = String(filePath).match(/\.(jpg|jpeg|png|webp)$/i);
    const suffix = suffixMatch ? suffixMatch[0].toLowerCase() : ".jpg";
    const res = await wx.cloud.uploadFile({
      cloudPath: `seal-photos/${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
      filePath
    });
    return res.fileID;
  },

  saveLocalSealApplication(user, flow, baseRecord) {
    const records = wx.getStorageSync("sealApplications") || [];
    wx.setStorageSync("sealApplications", [{
      ...baseRecord,
      applicant: user.name,
      applicantRoleKey: user.roleKey,
      department: user.department,
      status: "pending",
      approvalRequired: true,
      approvalFlow: flow,
      currentStepIndex: 0
    }, ...records]);
  },

  async createCloudInstrumentFlow(record) {
    if (!wx.cloud) return "";
    try {
      const res = await wx.cloud.callFunction({
        name: "createInstrumentFlow",
        data: {
          user: getCurrentUser(),
          record
        }
      });
      const result = res.result || {};
      return result.ok ? result.recordId : "";
    } catch (error) {
      return "";
    }
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

  loadMeetingRooms() {
    this.setData({
      roomLoading: true,
      roomTimelineRooms: []
    });
    if (!wx.cloud) {
      this.setData({
        meetingRooms: defaultMeetingRooms,
        roomLoading: false
      }, () => {
        this.buildRoomTimeline();
      });
      return Promise.resolve();
    }
    return wx.cloud.callFunction({
      name: "listMeetingRooms"
    }).then((res) => {
      const result = res.result || {};
      const rooms = result.ok && result.rooms && result.rooms.length
        ? result.rooms.map((room) => ({
          id: room.roomId || room._id,
          name: room.name,
          capacity: room.capacity,
          features: room.features || "",
          bookings: []
        }))
        : defaultMeetingRooms;
      this.setData({
        meetingRooms: rooms,
        roomLoading: false
      });
      return this.loadRoomBookings();
    }).catch(() => {
      this.setData({
        meetingRooms: defaultMeetingRooms,
        roomLoading: false
      }, () => {
        this.buildRoomTimeline();
      });
    });
  },

  loadRoomBookings() {
    if (!wx.cloud) {
      this.buildRoomTimeline();
      return Promise.resolve();
    }
    return wx.cloud.callFunction({
      name: "listRoomBookings",
      data: {
        date: this.data.form.meetingDate || this.data.todayDate
      }
    }).then((res) => {
      const result = res.result || {};
      this.setData({
        roomBookingRecords: result.ok ? (result.records || []) : []
      }, () => {
        this.buildRoomTimeline();
      });
    }).catch(() => {
      this.setData({
        roomBookingRecords: []
      }, () => {
        this.buildRoomTimeline();
      });
    });
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
