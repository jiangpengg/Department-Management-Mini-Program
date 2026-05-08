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

module.exports = {
  getCurrentUser,
  ensureAuthorized,
  hasCapability
};
