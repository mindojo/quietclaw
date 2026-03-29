/**
 * Current legal bundle version. Shared between main and renderer.
 * Keep this file free of node: imports so the renderer webpack can bundle it.
 */
export const LEGAL_BUNDLE_VERSION = "2026-03-29.1";

export function isCurrentLegalAcceptance(bundleVersion: string | null): boolean {
  return bundleVersion === LEGAL_BUNDLE_VERSION;
}
