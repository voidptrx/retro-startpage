/**
 * Browser detection utilities for extension
 */

/**
 * Check if running in Chrome.
 * Google Tasks backend only works in Chrome due to chrome.identity API requirements
 */
export function isChrome() {
    return (
        typeof chrome !== 'undefined' &&
        chrome.identity?.getAuthToken !== undefined &&
        chrome.runtime?.id !== undefined
    )
}

/**
 * Check if running in Firefox
 */
export function isFirefox() {
    return typeof browser !== 'undefined' && browser.runtime?.id !== undefined
}

/**
 * Get the browser name
 */
export function getBrowserName() {
    if (isChrome()) {
        return 'chrome'
    }
    if (isFirefox()) {
        return 'firefox'
    }
    return 'unknown'
}
