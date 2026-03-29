import { Menu, type MenuItemConstructorOptions, app } from "electron";

export function installAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    ...(process.env.NODE_ENV === "development"
      ? [
          {
            label: "View",
            submenu: [{ role: "reload" }, { role: "toggleDevTools" }],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
