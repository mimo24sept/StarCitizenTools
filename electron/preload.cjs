const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getMeta: () => ipcRenderer.invoke("app:get-meta"),
  readBytes: (relativePath) => ipcRenderer.invoke("fs:read-bytes", relativePath),
  writeBytes: (relativePath, arrayBuffer) => ipcRenderer.invoke("fs:write-bytes", relativePath, arrayBuffer),
  runSync: () => ipcRenderer.invoke("sync:run"),
  runTradeSync: () => ipcRenderer.invoke("trade:sync"),
  getTradeSnapshot: () => ipcRenderer.invoke("trade:get-snapshot")
});
