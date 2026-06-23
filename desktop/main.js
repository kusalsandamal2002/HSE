const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

const FRONTEND_URL = "http://localhost:5173";
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

function getSafeExternalUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;

  try {
    const parsedUrl = new URL(rawUrl);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) return null;
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "HSE",
    backgroundColor: "#f4f7fb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const safeUrl = getSafeExternalUrl(url);
    if (safeUrl) shell.openExternal(safeUrl);
    return { action: "deny" };
  });
}

ipcMain.handle("hse-desktop:openExternal", async (_event, rawUrl) => {
  const safeUrl = getSafeExternalUrl(rawUrl);
  if (!safeUrl) {
    throw new Error("Invalid external URL.");
  }

  await shell.openExternal(safeUrl);
  return true;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
