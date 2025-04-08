/**
 * Base class for all background models
 * Defines the interface that all background models must implement
 */
export default class BaseBackgroundModel {
    constructor(debugCallback) {
        this.debugCallback = debugCallback || console.log;
    }

    /**
     * Initialize the model - load resources, set up parameters
     * @returns {Promise<boolean>} True if initialization successful
     */
    async init() {
        this.debugCallback('Base model init called - override in subclass');
        return false; // Must be implemented by subclasses
    }

    /**
     * Process a single video frame with background replacement
     * @param {HTMLVideoElement} videoElement The source video element
     * @param {HTMLCanvasElement} canvasElement The target canvas element
     * @param {string} backgroundType The type of background ('blur', 'beach', 'custom', etc.)
     * @param {Image|HTMLCanvasElement} backgroundImage Optional background image for replacement
     * @returns {Object} Object with performance metrics (segmentationTime, totalTime)
     */
    async processFrame(videoElement, canvasElement, backgroundType, backgroundImage) {
        this.debugCallback('Base processFrame called - override in subclass');
        // Draw original frame as fallback
        const ctx = canvasElement.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        return {
            segmentationTime: 0,
            totalTime: 0
        };
    }

    /**
     * Clean up resources, cancel any pending operations
     */
    dispose() {
        this.debugCallback('Base dispose called - override in subclass if needed');
    }
}