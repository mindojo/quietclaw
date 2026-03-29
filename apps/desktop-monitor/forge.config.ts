import type { ForgeConfig } from "@electron-forge/shared-types";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import path from "node:path";

const assetsDir = path.resolve(__dirname, "assets");
const isDevMode = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Webpack dev mode requires 'unsafe-eval' for source maps and HMR
  isDevMode ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Dev mode needs ws: for webpack HMR websocket
  isDevMode ? "connect-src 'self' ws:" : "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const packageIgnorePatterns = [
  /^[/\\](?:tests|services)(?:[/\\]|$)/,
  /^[/\\]\.(?:workstream|claude)(?:[/\\]|$)/,
  /(?:^|[/\\])__tests__(?:[/\\]|$)/,
  /(?:^|[/\\])[^/\\]+\.(?:test|spec)\.[cm]?[jt]sx?$/i,
];
const keepWebpackOutputPattern = /^[/\\]\.webpack($|[/\\]).*$/;
const macSigningCredentials = getMacSigningCredentials();
const macCodeSigningIdentity = process.env.APPLE_CODESIGN_IDENTITY;
const windowsCertificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
const windowsCertificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD;

function getMacSigningCredentials() {
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE;
  const keychain = process.env.APPLE_KEYCHAIN_PATH;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!teamId) {
    return undefined;
  }

  if (keychainProfile) {
    return {
      keychainProfile,
      keychain,
    };
  }

  if (!appleId || !appleIdPassword) {
    return undefined;
  }

  return {
    appleId,
    appleIdPassword,
    teamId,
  };
}

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "com.quietclaw.desktop-monitor",
    asar: true,
    executableName: "QuietClaw",
    icon: path.resolve(assetsDir, "icon"),
    ignore: (file: string) => {
      if (!file) {
        return false;
      }

      if (
        file.endsWith(path.join(".webpack", "main", "stats.json")) ||
        file.endsWith(path.join(".webpack", "renderer", "stats.json"))
      ) {
        return true;
      }

      if (/[^/\\]+\.js\.map$/.test(file)) {
        return true;
      }

      if (packageIgnorePatterns.some((pattern) => pattern.test(file))) {
        return true;
      }

      return !keepWebpackOutputPattern.test(file);
    },
    name: "QuietClaw",
    osxNotarize: macSigningCredentials,
    osxSign: {
      hardenedRuntime: true,
      identity: macCodeSigningIdentity || undefined,
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config:
        windowsCertificateFile && windowsCertificatePassword
          ? {
              certificateFile: windowsCertificateFile,
              certificatePassword: windowsCertificatePassword,
            }
          : {},
      platforms: ["win32"],
    },
    {
      name: "@electron-forge/maker-zip",
      config: {},
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {},
      platforms: ["darwin"],
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig: path.resolve(__dirname, "webpack.main.config.ts"),
      renderer: {
        config: path.resolve(__dirname, "webpack.renderer.config.ts"),
        entryPoints: [
          {
            html: path.resolve(__dirname, "src/renderer/index.html"),
            js: path.resolve(__dirname, "src/renderer/index.tsx"),
            name: "main_window",
            preload: {
              js: path.resolve(__dirname, "src/preload/index.ts"),
            },
          },
        ],
      },
      devContentSecurityPolicy: contentSecurityPolicy,
    }),
  ],
};

export default config;
