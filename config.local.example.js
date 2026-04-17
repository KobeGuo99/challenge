window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, {
  storage: Object.assign({}, (window.APP_CONFIG && window.APP_CONFIG.storage) || {}, {
    binId: "PASTE_YOUR_REAL_BIN_ID_HERE",
    apiKey: "",
    accessKey: "PASTE_YOUR_REAL_ACCESS_KEY_HERE"
  })
});
