const { applications, getStatusMeta } = require("../../utils/mock");
const { ensureAuthorized, hasCapability, getCurrentUser, canManageSystem } = require("../../utils/auth");

Page({
  data: {
    filters: [],
    activeFilter: "review",
    applications: [],
    visibleApplications: []
  },

  onLoad() {
    if (!ensureAuthorized()) return;
    if (!hasCapability("approve")) {
      const user = getCurrentUser();
      this.setData({
        filters: [
          { key: "review", name: "待审查" },
          { key: "rejected", name: "驳回" },
          { key: "all", name: "全部" }
        ],
        activeFilter: "review"
      });
      this.loadApplications(user);
      return;
    }
    this.setData({
      filters: this.buildFilters(),
      activeFilter: "review"
    });
    this.loadApplications();
  },

  buildFilters() {
    if (canManageSystem()) {
      return [
        { key: "review", name: "待审查" },
        { key: "all", name: "全部" }
      ];
    }
    const user = getCurrentUser();
    if (user.roleKey === "section_manager") {
      return [
        { key: "review", name: "科室待审" },
        { key: "rejected", name: "驳回" },
        { key: "all", name: "全部" }
      ];
    }
    return [
      { key: "review", name: "待审查" },
      { key: "rejected", name: "驳回" },
      { key: "all", name: "全部" }
    ];
  },

  async loadApplications() {
    const cloudSealApplications = await this.loadCloudSealApplications();
    const localSealApplications = wx.getStorageSync("sealApplications") || [];
    const cloudIds = cloudSealApplications.map((item) => item.id || item._id);
    const localFallback = localSealApplications.filter((item) => cloudIds.indexOf(item.id) < 0);
    const list = applications.concat(cloudSealApplications, localFallback).filter((item) => item.approvalRequired).filter((item) => {
      const user = getCurrentUser();
      if (canManageSystem()) return true;
      if (user.roleKey === "section_manager") {
        return item.department === user.department;
      }
      return item.applicant === user.name;
    }).map((item) => {
      const meta = getStatusMeta(item.status);
      return this.decorateApplication({ ...item, statusText: meta.text, statusTone: meta.tone });
    });
    this.setData({ applications: list }, this.applyFilter);
  },

  async loadCloudSealApplications() {
    if (!wx.cloud) return [];
    try {
      const res = await wx.cloud.callFunction({
        name: "listSealApplications",
        data: {
          user: getCurrentUser()
        }
      });
      const result = res.result || {};
      return result.ok ? (result.records || []) : [];
    } catch (error) {
      return [];
    }
  },

  onShow() {
    if (this.getTabBar) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (hasCapability("approve")) {
      this.loadApplications();
    }
  },

  switchFilter(event) {
    this.setData({
      activeFilter: event.currentTarget.dataset.key
    }, this.applyFilter);
  },

  applyFilter() {
    const { activeFilter, applications: list } = this.data;
    if (activeFilter === "review") {
      this.setData({
        visibleApplications: list.filter((item) => item.status === "pending" && item.canReview)
      });
      return;
    }
    this.setData({
      visibleApplications: activeFilter === "all" ? list : list.filter((item) => item.status === activeFilter)
    });
  },

  decorateApplication(item) {
    const flow = item.approvalFlow || [];
    const stepIndex = item.currentStepIndex || 0;
    const currentStep = flow[stepIndex];
    return {
      ...item,
      currentStepText: item.status === "pending" && currentStep ? currentStep.name : "",
      flowText: flow.map((step, index) => `${index + 1}.${step.name}`).join(" → "),
      canReview: this.canReviewStep(item, currentStep)
    };
  },

  canReviewStep(item, currentStep) {
    if (item.status !== "pending" || !currentStep) return false;
    const user = getCurrentUser();
    if (currentStep.key === "section") {
      return user.roleKey === "section_manager" && user.department === item.department;
    }
    if (currentStep.key === "institute") {
      return canManageSystem();
    }
    return canManageSystem();
  },

  async handleApproval(event) {
    const { id, action } = event.currentTarget.dataset;
    const target = this.data.applications.find((item) => item.id === id || item._id === id);
    if (target && target._id) {
      const updated = await this.updateCloudApplication(target, action);
      if (!updated) return;
    }
    const nextList = this.data.applications.map((item) => {
      if (item.id !== id && item._id !== id) return item;
      if (action === "reject") {
        const meta = getStatusMeta("rejected");
        return this.decorateApplication({ ...item, status: "rejected", statusText: meta.text, statusTone: meta.tone });
      }
      const flow = item.approvalFlow || [];
      const nextStepIndex = (item.currentStepIndex || 0) + 1;
      const nextStatus = nextStepIndex >= flow.length ? "approved" : "pending";
      const meta = getStatusMeta(nextStatus);
      return this.decorateApplication({
        ...item,
        status: nextStatus,
        currentStepIndex: nextStepIndex,
        statusText: meta.text,
        statusTone: meta.tone
      });
    });

    this.setData({ applications: nextList }, this.applyFilter);
    const localUpdates = nextList.filter((item) => String(item.id).indexOf("SEAL-") === 0);
    const previousLocal = wx.getStorageSync("sealApplications") || [];
    const mergedLocal = previousLocal.map((record) => {
      const updated = localUpdates.find((item) => item.id === record.id);
      return updated || record;
    });
    wx.setStorageSync("sealApplications", mergedLocal);
    wx.showToast({
      title: action === "approve" ? "已提交下一步" : "已驳回",
      icon: "success"
    });
  },

  async updateCloudApplication(item, action) {
    if (!wx.cloud) return true;
    try {
      const res = await wx.cloud.callFunction({
        name: "updateSealApplication",
        data: {
          recordId: item._id,
          action,
          user: getCurrentUser()
        }
      });
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({
          title: result.message || "云端审批失败",
          icon: "none"
        });
        return false;
      }
      return true;
    } catch (error) {
      wx.showToast({
        title: "云端审批失败",
        icon: "none"
      });
      return false;
    }
  }
});
