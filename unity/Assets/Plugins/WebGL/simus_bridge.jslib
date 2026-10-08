mergeInto(LibraryManager.library, {
  SimusBridgeEmit: function (json) {
    if (window.simusBridge) window.simusBridge.runtime(UTF8ToString(json));
  }
});
