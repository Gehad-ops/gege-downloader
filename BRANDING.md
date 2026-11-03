# Branding Gege Downloader

Gege Downloader's name, identity and logo all come from a few places. To make it yours:

1. **Name / metadata** — edit `src/shared/branding.json` (name, shortName, appId, protocol, repo, website, copyright, author, description).
2. **Logo** — replace `branding/logo.png` with a 1024x1024 PNG, then run `npm run brand` to regenerate `build/icon.png`, `build/icon.ico`, `resources/icon-dark.png` and the extension icons. Or run `scripts/make-logo.ps1` directly.
3. **Build** — `npm run build:win` (x64 NSIS installer → `dist/gege-downloader-<version>-setup.exe`).

Runtime text (title bar, window title, tray, menus, error messages) reads from `src/shared/brand.ts`, which imports `branding.json`, so it stays in sync automatically.

To change the Windows architecture targets, edit `arch` in `electron-builder.config.cjs`.