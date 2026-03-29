type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta?: unknown): void {
  const prefix = `[desktop-monitor:${level}]`;

  if (typeof meta === "undefined") {
    console[level](prefix, message);
    return;
  }

  console[level](prefix, message, meta);
}

export const log = {
  info(message: string, meta?: unknown) {
    write("info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    write("warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    write("error", message, meta);
  },
};
