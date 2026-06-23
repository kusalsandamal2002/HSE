const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hseDesktop", {
  openExternal(url) {
    return ipcRenderer.invoke("hse-desktop:openExternal", url);
  },
});
