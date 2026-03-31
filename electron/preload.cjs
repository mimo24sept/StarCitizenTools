const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getMeta: () => ipcRenderer.invoke("app:get-meta"),
  readBytes: (relativePath) => ipcRenderer.invoke("fs:read-bytes", relativePath),
  writeBytes: (relativePath, arrayBuffer) => ipcRenderer.invoke("fs:write-bytes", relativePath, arrayBuffer),
  runSync: () => ipcRenderer.invoke("sync:run"),
  runTradeSync: () => ipcRenderer.invoke("trade:sync"),
  getTradeSnapshot: () => ipcRenderer.invoke("trade:get-snapshot"),
  getOverlayState: () => ipcRenderer.invoke("overlay:get-state"),
  showOverlay: (route) => ipcRenderer.invoke("overlay:show", route),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  setOverlayProgress: (progressIndex) => ipcRenderer.invoke("overlay:set-progress", progressIndex),
  resetOverlayProgress: () => ipcRenderer.invoke("overlay:reset-progress"),
  onOverlayState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("overlay:state", handler);
    return () => ipcRenderer.removeListener("overlay:state", handler);
  },
  onOverlayRender: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("overlay:render", handler);
    return () => ipcRenderer.removeListener("overlay:render", handler);
  }
});
