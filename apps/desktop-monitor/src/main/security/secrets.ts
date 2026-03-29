import { safeStorage } from "electron";

export type TokenStorageMode = "none" | "secure" | "obfuscated";

export type DecryptedTokenState = {
  token: string | null;
  tokenSaved: boolean;
  tokenStorage: TokenStorageMode;
  recoveryRequired: boolean;
};

const SECURE_TOKEN_PREFIX = "safe:";
const OBFUSCATED_TOKEN_PREFIX = "weak:";

export function encryptToken(token: string | null): {
  encryptedToken: string | null;
  tokenStorage: TokenStorageMode;
} {
  if (!token) {
    return {
      encryptedToken: null,
      tokenStorage: "none",
    };
  }

  try {
    if (safeStorage.isEncryptionAvailable()) {
      return {
        encryptedToken:
          SECURE_TOKEN_PREFIX +
          safeStorage.encryptString(token).toString("base64"),
        tokenStorage: "secure",
      };
    }
  } catch {
    // Fall back to weaker obfuscation below.
  }

  return {
    encryptedToken:
      OBFUSCATED_TOKEN_PREFIX + Buffer.from(token, "utf8").toString("base64"),
    tokenStorage: "obfuscated",
  };
}

export function decryptToken(
  encryptedToken: string | null,
): DecryptedTokenState {
  if (!encryptedToken) {
    return {
      token: null,
      tokenSaved: false,
      tokenStorage: "none",
      recoveryRequired: false,
    };
  }

  try {
    if (encryptedToken.startsWith(SECURE_TOKEN_PREFIX)) {
      const raw = encryptedToken.slice(SECURE_TOKEN_PREFIX.length);
      const token = safeStorage.decryptString(Buffer.from(raw, "base64"));

      return {
        token,
        tokenSaved: true,
        tokenStorage: "secure",
        recoveryRequired: false,
      };
    }

    if (encryptedToken.startsWith(OBFUSCATED_TOKEN_PREFIX)) {
      const raw = encryptedToken.slice(OBFUSCATED_TOKEN_PREFIX.length);

      return {
        token: Buffer.from(raw, "base64").toString("utf8"),
        tokenSaved: true,
        tokenStorage: "obfuscated",
        recoveryRequired: false,
      };
    }
  } catch {
    return {
      token: null,
      tokenSaved: false,
      tokenStorage: "none",
      recoveryRequired: true,
    };
  }

  return {
    token: null,
    tokenSaved: false,
    tokenStorage: "none",
    recoveryRequired: true,
  };
}

export const encryptGatewayToken = encryptToken;
export const decryptGatewayToken = decryptToken;
export const encryptTelegramBotToken = encryptToken;
export const decryptTelegramBotToken = decryptToken;
