import { app, BrowserWindow } from "electron";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const isPackaged = app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function isAllowedAppUrl(url: string): boolean {
  try {
    const allowedUrl = new URL(MAIN_WINDOW_WEBPACK_ENTRY);
    const nextUrl = new URL(url);

    if (allowedUrl.protocol === "file:") {
      return nextUrl.href === allowedUrl.href;
    }

    return (
      nextUrl.origin === allowedUrl.origin &&
      nextUrl.pathname === allowedUrl.pathname
    );
  } catch {
    return false;
  }
}

export async function createMainWindow(): Promise<BrowserWindow> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#f4f4f2",
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true in production, false in dev (webpack dev server needs unsafe-eval)
      sandbox: isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault();
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
