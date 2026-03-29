import type { MonitorAppApi } from "../../preload/api";

function getMonitorAppApi(): MonitorAppApi {
  if (!window.monitorApp) {
    throw new Error("monitorApp preload API is unavailable.");
  }

  return window.monitorApp;
}

export const monitorAppClient: MonitorAppApi = {
  getBootstrapState: () => getMonitorAppApi().getBootstrapState(),
  acceptLegal: (record) => getMonitorAppApi().acceptLegal(record),
  detectAiProviders: () => getMonitorAppApi().detectAiProviders(),
  testAiConnection: () => getMonitorAppApi().testAiConnection(),
  setTelegramBotToken: (token) => getMonitorAppApi().setTelegramBotToken(token),
  resetConnections: () => getMonitorAppApi().resetConnections(),
  resetEverything: () => getMonitorAppApi().resetEverything(),
  resetTelegramConnection: () => getMonitorAppApi().resetTelegramConnection(),
  sendTestTelegramMessage: () => getMonitorAppApi().sendTestTelegramMessage(),
  getTelegramStatus: () => getMonitorAppApi().getTelegramStatus(),
  getDaemonStatus: () => getMonitorAppApi().getDaemonStatus(),
  getGroups: () => getMonitorAppApi().getGroups(),
  getGroupMembers: (groupId) => getMonitorAppApi().getGroupMembers(groupId),
  hideGroup: (groupId) => getMonitorAppApi().hideGroup(groupId),
  openExternal: (url) => getMonitorAppApi().openExternal(url),
  openLegalDocument: (documentId) => getMonitorAppApi().openLegalDocument(documentId),
  getMonitor: () => getMonitorAppApi().getMonitor(),
  getPromptTemplates: () => getMonitorAppApi().getPromptTemplates(),
  saveMonitor: (input) => getMonitorAppApi().saveMonitor(input),
  savePromptTemplate: (kind, template) =>
    getMonitorAppApi().savePromptTemplate(kind, template),
  resetPromptTemplate: (kind) => getMonitorAppApi().resetPromptTemplate(kind),
  sendTestSummary: () => getMonitorAppApi().sendTestSummary(),
  getRunnerStatus: () => getMonitorAppApi().getRunnerStatus(),
  getActivity: () => getMonitorAppApi().getActivity(),
  clearActivity: () => getMonitorAppApi().clearActivity(),
  listDemoScenarios: () => getMonitorAppApi().listDemoScenarios(),
  runDemoScenario: (id) => getMonitorAppApi().runDemoScenario(id),
  resetDemo: () => getMonitorAppApi().resetDemo(),
  getSettings: () => getMonitorAppApi().getSettings(),
  saveSettings: (input) => getMonitorAppApi().saveSettings(input),
  checkForUpdates: () => getMonitorAppApi().checkForUpdates(),
  exportDiagnostics: () => getMonitorAppApi().exportDiagnostics(),
  subscribe: (listener) => getMonitorAppApi().subscribe(listener),
};
