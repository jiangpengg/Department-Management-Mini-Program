function getCurrentUser() {
  return getApp().globalData.user || {};
}

function ensureAuthorized() {
  const user = getCurrentUser();
  if (user.authorized) return true;

  wx.reLaunch({
    url: "/pages/access-denied/access-denied"
  });
  return false;
}

function hasCapability(capability) {
  const user = getCurrentUser();
  return Boolean(user.authorized && user.capabilities && user.capabilities.includes(capability));
}

function canManageSystem() {
  const user = getCurrentUser();
  return Boolean(
    user.authorized &&
    user.capabilities &&
    user.capabilities.includes("global_admin")
  );
}

function canManageDepartment() {
  const user = getCurrentUser();
  return Boolean(
    user.authorized &&
    user.capabilities &&
    (user.capabilities.includes("global_admin") || user.capabilities.includes("department_admin"))
  );
}

function getManageScope() {
  if (canManageSystem()) return "global";
  if (canManageDepartment()) return "department";
  return "self";
}

module.exports = {
  getCurrentUser,
  ensureAuthorized,
  hasCapability,
  canManageSystem,
  canManageDepartment,
  getManageScope
};
