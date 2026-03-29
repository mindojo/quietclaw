Required mac signing secrets:

- `APPLE_CERT_BASE64`: base64-encoded PKCS#12 file containing the Developer ID identity
- `APPLE_CERT_PASSWORD`: password used to export the PKCS#12 file
- `APPLE_KEYCHAIN_PASSWORD`: temporary password for the CI keychain
- `APPLE_TEAM_ID`: Apple Developer team ID
- `APPLE_CODESIGN_IDENTITY`: exact codesigning identity name, for example `Developer ID Application: Mindojo Ltd (VRZN33ZQL4)`

Choose one notarization method:

- Password-based:
  - `APPLE_ID`: Apple ID used for notarization
  - `APPLE_APP_SPECIFIC_PASSWORD`: Apple app-specific password used for notarization
- Keychain profile-based:
  - `APPLE_KEYCHAIN_PROFILE`: runner-local `notarytool` keychain profile name to create from the Apple ID and app-specific password secrets during the workflow

The CI workflows create a temporary keychain at runtime, import the signing certificate into it, and, when `APPLE_KEYCHAIN_PROFILE` is set, store notarization credentials in that temporary keychain before running the build.
