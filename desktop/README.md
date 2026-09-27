# SceneariX Desktop (Windows)

The desktop app bundles the optimized React production build and runs it in an isolated Electron window. End users do not need Node.js, VS Code, or a local development server. Internet access is still needed for Firebase, TMDB, trailers, and streaming sources.

## Build an installer

```powershell
npm run desktop:install
npm run desktop:test
npm run desktop:dist
```

The installer is written to `desktop/dist/SceneariX-Setup-<version>-x64.exe`.

For live development, start React in one terminal:

```powershell
npm start
```

Then launch the desktop shell from a second PowerShell terminal:

```powershell
$env:SCENEARIX_DESKTOP_URL = "http://localhost:3000"
npm run desktop:dev
```

Use `npm run desktop:pack` for an unpacked executable.

## Included

- Bundled minified production assets with immutable caching for hashed files.
- Frameless window controls, tray behavior, single-instance handling, and remembered window size.
- Persistent Firebase/web sessions in a dedicated Electron profile.
- SPA route fallback, safe external-link handling, downloads, fullscreen, and keyboard menu shortcuts.
- Node integration disabled, context isolation and sandboxing enabled, minimal permissions, and origin-checked IPC.

The Windows build is unsigned unless a code-signing certificate is configured. Increment `desktop/package.json` before each desktop release and update Electron regularly for current Chromium security fixes.
