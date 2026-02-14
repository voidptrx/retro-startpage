# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

re-start is a browser extension that provides a TUI-style startpage/new tab page built with Svelte 5. The extension supports multiple task backends (local storage, Todoist, Google Tasks), weather integration, customizable themes, and quick links.

## Build Commands

### Development
```bash
npm run dev              # Run just the webpage in dev mode at http://localhost:5173
npm run watch            # Build Firefox extension and watch for changes (use with web-ext)
npm run watch:firefox    # Same as watch
npm run watch:chrome     # Build Chrome extension and watch for changes
npm run watch:chrome:dev # Build Chrome extension with dev OAuth client
npm run watch:chrome:prod # Build Chrome extension with production OAuth client
```

### Production Builds
```bash
npm run build            # Build for Firefox (outputs to dist/firefox)
npm run build:firefox    # Build for Firefox (outputs to dist/firefox)
npm run build:chrome     # Build for Chrome (outputs to dist/chrome)
npm run build:chrome:dev # Build for Chrome with dev OAuth client
npm run build:chrome:prod # Build for Chrome with production OAuth client
```

### Testing
```bash
npm test                 # Run all tests with vitest
```

## Architecture

### Browser-Specific Builds

The project uses a custom Vite plugin (`buildManifest()` in vite.config.js) that runs `scripts/build-manifest.js` after each build. This script:
- Modifies `public/manifest.json` based on target browser (Firefox/Chrome)
- For Chrome: removes `browser_specific_settings` and `chrome_settings_overrides`, keeps `oauth2` config
- For Firefox: removes `oauth2` and `identity` permission (not supported)
- Handles OAuth client ID selection via `CLIENT_ENV` environment variable (dev/prod)

The build output directory determines which browser manifest is generated.

### Task Backend System

Task backends follow an abstract class pattern (`src/lib/backends/task-backend.js`) with three implementations:
- **localstorage-backend.js**: Local-only task storage
- **todoist-backend.js**: Syncs with Todoist API
- **google-tasks-backend.js**: Chrome-only, uses `chrome.identity.getAuthToken()` for OAuth

All backends implement: `sync()`, `getTasks()`, `addTask()`, `completeTask()`, `uncompleteTask()`, `deleteTask()`, `clearLocalData()`.

Backend selection is managed through `src/lib/backends/index.js` which instantiates the appropriate backend based on settings.

### Smart Task Input

Two key parsing utilities:
- **date-matcher.js**: Natural language date parsing (e.g., "tomorrow", "friday", "dec 25", "jan 1 3pm")
- **project-matcher.js**: Detects `#projectname` syntax in task input to assign projects/lists

These work together in the `AddTask.svelte` component to provide smart task creation.

### Settings & State

Settings are managed via Svelte 5 runes in `settings-store.svelte.js`:
- Persisted to localStorage
- Reactive `$state()` exported as `settings`
- Default settings include task backend, theme, location, formats, links

### Theme System

Themes are defined in `src/lib/themes.js` as CSS custom properties. The Vite build injects theme data into HTML at build time via the `injectThemeScript()` plugin, enabling instant theme application before JS loads (prevents flash).

### Component Structure

Main components in `src/lib/components/`:
- **Clock.svelte**: Time/date display
- **Weather.svelte**: Weather widget using Open-Meteo API
- **Tasks.svelte**: Task list with backend integration
- **AddTask.svelte**: Smart task input with date/project parsing
- **Links.svelte**: Quick links grid
- **Stats.svelte**: Performance stats (load time, ping, FPS, viewport)
- **Settings.svelte**: Settings modal with all configuration options

### Browser Detection

`src/lib/browser-detect.js` exports `isChrome()` to gate Chrome-specific features (Google Tasks integration).

## Testing

Tests are located in `src/lib/tests/`. Currently only `date-matcher.test.js` exists. Use vitest for testing.

## Key Files

- `vite.config.js`: Custom build plugins for manifest generation and theme injection
- `scripts/build-manifest.js`: Browser-specific manifest generation
- `public/manifest.json`: Source manifest (gets modified per browser during build)
- `src/App.svelte`: Root component, manages settings, theme application, and layout
- `src/lib/settings-store.svelte.js`: Central settings state
- `src/lib/themes.js`: Theme definitions

## Important Notes

- When modifying manifest permissions or OAuth configuration, edit `public/manifest.json` and ensure `scripts/build-manifest.js` handles it correctly for both browsers
- Google Tasks functionality is Chrome-only due to `chrome.identity.getAuthToken()` API requirement
- Theme data is injected at build time to prevent FOUC (Flash of Unstyled Content)
- All task backends must implement the TaskBackend abstract class interface
