import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import fs from 'fs'
import { execSync } from 'child_process'
import path from 'path'

// Read version from manifest.json at build time
const manifest = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf-8'))

// Plugin to inline theme CSS and inject theme switching script
function injectThemeScript() {
    return {
        name: 'inject-theme-script',
        transformIndexHtml(html) {
            // Read theme CSS file
            const themesCSS = fs.readFileSync(
                './src/lib/config/themes.css',
                'utf-8'
            )

            // Read default theme from themes.js
            const themesModule = fs.readFileSync(
                './src/lib/config/themes.js',
                'utf-8'
            )
            const defaultThemeMatch = themesModule.match(
                /export const defaultTheme = ['"](.+?)['"]/
            )

            if (!defaultThemeMatch) {
                console.error('Failed to extract default theme')
                return html
            }

            const defaultTheme = defaultThemeMatch[1]

            // Create inline styles with all themes
            const styleTag = `<style>${themesCSS}</style>`

            // Create simplified theme switching script
            const themeScript = `<script>
            (function() {
                const defaultTheme = '${defaultTheme}';
                try {
                    const stored = localStorage.getItem('settings');
                    let themeName = defaultTheme;
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.currentTheme) {
                            themeName = parsed.currentTheme;
                        }
                    }
                    document.documentElement.className = 'theme-' + themeName;
                } catch (e) {
                    document.documentElement.className = 'theme-' + defaultTheme;
                }
            })();
            </script>`

            // Replace the old script placeholder with new implementation
            // Inject styles in head, and the script stays where it is
            return html
                .replace(
                    /<script>[\s\S]*?__THEMES_DATA__[\s\S]*?<\/script>/,
                    themeScript
                )
                .replace('</head>', `${styleTag}\n</head>`)
        },
    }
}

// Plugin to exclude manifest.json from public copy (we'll generate it separately)
function excludeManifest() {
    return {
        name: 'exclude-manifest',
        generateBundle(options, bundle) {
            // Remove manifest.json from bundle if Vite copied it
            delete bundle['manifest.json']
        },
    }
}

// Plugin to run build-manifest.js after each build (including in watch mode)
function buildManifest() {
    let outDir = 'dist/firefox'

    return {
        name: 'build-manifest',
        configResolved(config) {
            // Get the output directory from Vite config
            outDir = config.build.outDir
        },
        closeBundle() {
            // Detect browser from output directory
            const browser = outDir.includes('chrome') ? 'chrome' : 'firefox'

            try {
                execSync(
                    `node scripts/build-manifest.js ${browser} ${outDir}`,
                    {
                        stdio: 'inherit',
                    }
                )
            } catch (error) {
                console.error('Failed to build manifest:', error.message)
            }
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        svelte(),
        injectThemeScript(),
        excludeManifest(),
        buildManifest(),
        {
            name: 'fix-for-file-protocol',
            transformIndexHtml(html) {
                return html
                    .replace(/type="module"\s*/g, '')
                    .replace(/crossorigin\s*/g, '')
                    .replace(/<script /g, '<script defer ') // defer ekle
            },
        },
    ],
    define: {
        __APP_VERSION__: JSON.stringify(manifest.version),
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                format: 'iife', // Bu satır önemli - modül yerine klasik format
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
                inlineDynamicImports: true, // Tüm kodu tek dosyada birleştirir
            },
        },
    },
})
