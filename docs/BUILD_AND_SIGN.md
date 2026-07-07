# Building and Code Signing

## Building the app

- **Renderer (Vite):** `npm run build:renderer`
- **Full app (no signing):** `npm run build:win` (Windows), `npm run build:mac`, `npm run build:linux`
- **All platforms:** `npm run build:all`

Output goes to `dist/` (installer and unpacked artifacts).

## Windows code signing (avoid “Unknown publisher” warnings)

To sign the Windows executable so users don’t see SmartScreen / “Windows protected your PC”:

1. **Obtain a code signing certificate**
   - **EV (recommended):** from a CA (DigiCert, Sectigo, etc.). Often requires hardware token; gives immediate SmartScreen reputation.
   - **Standard (OV):** cheaper; SmartScreen reputation builds over time.

2. **Export to PFX** (if you have a cert in Windows Certificate Store)
   - `certmgr.msc` → Personal → Certificates → your code signing cert → Right‑click → All Tasks → Export.
   - Export private key, format **PFX**, set a password.

3. **Configure electron-builder with env vars**

   | Variable | Description |
   |--------|--------------|
   | `WIN_CSC_LINK` | Path to your `.pfx` file (or base64 of the file for CI) |
   | `WIN_CSC_KEY_PASSWORD` | Password for the PFX |
   | `WIN_CSC_SUBJECT_NAME` | Subject name of the cert (e.g. `"CN=Your Name"`); optional if only one cert in PFX |

   Example (PowerShell, local):

   ```powershell
   $env:WIN_CSC_LINK = "C:\path\to\your-cert.pfx"
   $env:WIN_CSC_KEY_PASSWORD = "YourPfxPassword"
   npm run build:win
   ```

4. **CI (e.g. GitHub Actions)**  
   Store the PFX (or its base64) and password as **secrets**. Decode PFX in the workflow and set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` before running `npm run build:win`. See [electron-builder code signing](https://www.electron.build/code-signing).

If these env vars are **not** set, the build still runs but the exe is **unsigned**; users may see SmartScreen or “Unknown publisher”.

## Clean machine / portable testing

After building:

1. Copy the installer (e.g. `dist/Impulse IDE Setup 1.0.0.exe`) to a clean machine or VM.
2. Install and run. Confirm: open folder, compile, upload, serial monitor, AI panel.
3. Check that user data (sketches, memory, settings) lives under the correct app data folder (e.g. `%APPDATA%\Impulse IDE` on Windows when built with this productName).

## No CDN dependency (packaged app)

The packaged app does **not** rely on any CDN:

- **CodeMirror:** Bundled by Vite from `node_modules/codemirror`.
- **Fonts:** Bundled from `bb-manual-mono-pro` (or local assets); Vite copies them into `dist-renderer/assets/`.
- **CSP:** Allows `fonts.googleapis.com` / `fonts.gstatic.com` only for optional web font fallback; the app works fully offline.

To make the app strictly offline, you can remove those origins from the CSP in `src/main/main.js` (see `Content-Security-Policy` there).
