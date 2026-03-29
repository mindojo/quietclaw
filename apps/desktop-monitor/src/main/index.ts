import { app } from "electron";

import { registerAppIpc, rendererEventBus } from "./ipc/registerAppIpc";
import { log } from "./logging";
import { installAppMenu } from "./menu";
import { createDesktopAppRuntime } from "./startup/bootstrap";
import { DesktopAppUpdater } from "./updates/updater";
import { createMainWindow, getMainWindow } from "./windows";

async function bootstrap(): Promise<void> {
  app.setAppUserModelId("com.quietclaw.desktop-monitor");

  await app.whenReady();

  const updater = new DesktopAppUpdater({
    onStateChanged: () => {
      rendererEventBus.emit({ type: "settings-changed" });
    },
  });
  const runtime = createDesktopAppRuntime({
    emit: (event) => {
      rendererEventBus.emit(event);
    },
    updater,
  });
  await runtime.initialize();
  updater.initialize();

  installAppMenu();
  registerAppIpc(runtime);
  await createMainWindow();

  let shuttingDown = false;

  app.on("before-quit", (event) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    event.preventDefault();

    void runtime.shutdown()
      .catch((error) => {
        log.error("Failed to shutdown desktop monitor cleanly.", error);
      })
      .finally(() => {
        app.quit();
      });
  });

  app.on("activate", async () => {
    if (!getMainWindow()) {
      await createMainWindow();
    }
  });
}

void bootstrap().catch((error: unknown) => {
  log.error("Failed to bootstrap desktop monitor.", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
