import { contextBridge, ipcRenderer } from "electron";

import { IPC_CHANNELS } from "../main/ipc/channels";
import {
  createMonitorAppApi,
  type RendererSubscriptionEvent,
} from "./api";

const monitorAppApi = createMonitorAppApi({
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  subscribe: (listener) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: RendererSubscriptionEvent,
    ) => listener(payload);

    ipcRenderer.on(IPC_CHANNELS.subscriptionEvent, wrappedListener);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.subscriptionEvent, wrappedListener);
    };
  },
});

contextBridge.exposeInMainWorld("monitorApp", monitorAppApi);
