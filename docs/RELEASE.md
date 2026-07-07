# Release process

1. **Update version and changelog**
   - Bump `version` in `package.json`.
   - In `CHANGELOG.md`, move items from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section and add a link at the bottom.

2. **Tag and push**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

3. **Build and optionally sign**
   - **Windows:** Set `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` (and optionally `WIN_CSC_SUBJECT_NAME`) if you have a code signing cert, then:
     ```bash
     npm run build:win
     ```
   - **macOS/Linux:** `npm run build:mac` / `npm run build:linux` (set `MAC_CSC_NAME` etc. for signing on Mac).

4. **Create a GitHub Release**
   - Go to the repo → Releases → “Draft a new release”.
   - Choose tag `vX.Y.Z`, title “vX.Y.Z”, and paste the relevant `CHANGELOG.md` section as the description.
   - Attach the installer(s) from `dist/` (e.g. `Impulse IDE Setup X.Y.Z.exe`).
   - Publish.

5. **Optional: auto-updater**
   If `publish` is configured in `package.json` and you use a release workflow that uploads to GitHub Releases, `electron-updater` can notify users of new versions; ensure the built installer is uploaded to the release as above.
