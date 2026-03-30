const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const devServerUrl = process.env.ELECTRON_RENDERER_URL;
const isDev = Boolean(devServerUrl);
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function createWindow() {
  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#07121c",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(ROOT_DIR, "web-dist", "index.html"));
  }
}

ipcMain.handle("app:get-meta", async () => {
  return {
    isDev,
    rootDir: ROOT_DIR,
    dataDir: DATA_DIR
  };
});

ipcMain.handle("fs:read-bytes", async (_event, relativePath) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  const buffer = await fs.promises.readFile(fullPath);
  return buffer;
});

ipcMain.handle("fs:write-bytes", async (_event, relativePath, arrayBuffer) => {
  const fullPath = path.join(ROOT_DIR, relativePath);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, Buffer.from(arrayBuffer));
  return true;
});

ipcMain.handle("sync:run", async () => {
  return await new Promise((resolve) => {
    const child = spawn("py", ["sync_all.py"], {
      cwd: ROOT_DIR,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr
      });
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: `${stderr}\n${String(error)}`
      });
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
