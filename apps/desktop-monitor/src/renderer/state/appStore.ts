import type { AlertColor } from "@mui/material";
import { create } from "zustand";

import type { DesktopMonitorUpsert } from "../../preload/api";

export type ToastItem = {
  id: string;
  message: string;
  severity: AlertColor;
};

type AppStore = {
  settingsOpen: boolean;
  telegramTokenDraft: string;
  monitorDraft: DesktopMonitorUpsert | null;
  toasts: ToastItem[];
  lastManualPreviewPayload: string | null;
  setSettingsOpen(open: boolean): void;
  setTelegramTokenDraft(value: string): void;
  replaceMonitorDraft(draft: DesktopMonitorUpsert | null): void;
  updateMonitorDraft(
    updater: (draft: DesktopMonitorUpsert) => DesktopMonitorUpsert,
  ): void;
  pushToast(input: Omit<ToastItem, "id"> & { id?: string }): void;
  dismissToast(id: string): void;
  setLastManualPreviewPayload(payload: string | null): void;
};

export const useAppStore = create<AppStore>((set) => ({
  settingsOpen: false,
  telegramTokenDraft: "",
  monitorDraft: null,
  toasts: [],
  lastManualPreviewPayload: null,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setTelegramTokenDraft: (value) => set({ telegramTokenDraft: value }),
  replaceMonitorDraft: (draft) => set({ monitorDraft: draft }),
  updateMonitorDraft: (updater) =>
    set((state) => ({
      monitorDraft: state.monitorDraft ? updater(state.monitorDraft) : state.monitorDraft,
    })),
  pushToast: (input) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: input.id ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
          message: input.message,
          severity: input.severity,
        },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    })),
  setLastManualPreviewPayload: (payload) =>
    set({ lastManualPreviewPayload: payload }),
}));
