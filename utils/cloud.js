const cloudEnvId = "cloud1-d8g9wtstx983f6e7f";

function initCloud() {
  if (!wx.cloud) {
    return false;
  }

  wx.cloud.init({
    env: cloudEnvId,
    traceUser: true
  });
  return true;
}

module.exports = {
  cloudEnvId,
  initCloud
};
