// General utility functions

/**
 * Formats bytes to human-readable format
 * @param {number} bytes - Number of bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string (e.g. "1.5 MB")
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g. "05:30")
 */
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generates a random meeting code
 * @returns {string} Random meeting code (6 characters, uppercase)
 */
export function generateMeetingCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Parse URL parameters into an object
 * @returns {Object} Key-value pairs of URL parameters
 */
export function getUrlParameters() {
    const params = {};
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    
    return params;
}

/**
 * Update debug information in the debug panel
 * @param {string} message - Debug message to display
 */
export function updateDebugInfo(message) {
    const debugInfoElement = document.getElementById('debugInfo');
    if (debugInfoElement) {
        debugInfoElement.textContent = message;
        console.log(message);
    }
}