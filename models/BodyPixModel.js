/**
 * BodyPixModel class for background segmentation using TensorFlow.js BodyPix
 * Extends the BaseBackgroundModel abstract class
 */
import BaseBackgroundModel from './BaseBackgroundModel.js';

class BodyPixModel extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        this.debugCallback = debugCallback || console.log; // Store it directly so we can use it
        this.model = null;
        this.initialized = false;
        this.net = null;
        this.segmentationConfig = {
            flipHorizontal: false,
            internalResolution: 'medium',
            segmentationThreshold: 0.7,
            maxDetections: 1,
        };
        
        this.renderConfig = {
            opacity: 0.7,
            maskBlurAmount: 3,
            flipHorizontal: false
        };
    }

    /**
     * Debug utility function
     * @param {string} message - Message to log
     */
    debug(message) {
        if (typeof this.debugCallback === 'function') {
            this.debugCallback(message);
        } else {
            console.log(`[BodyPixModel] ${message}`);
        }
    }

    /**
     * Initialize the BodyPix model
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async init() {
        try {
            this.debug('Initializing BodyPix model...');
            
            // First, ensure TensorFlow.js is loaded
            await this._loadTensorFlowScript();
            
            // Then, check if bodyPix is available in global scope
            if (!window.bodyPix) {
                // If not, dynamically load the script
                await this._loadBodyPixScript();
                
                // Wait to ensure scripts are fully initialized
                await new Promise(resolve => setTimeout(resolve, 500));
                
                if (!window.bodyPix) {
                    throw new Error('Failed to load bodyPix library');
                }
            }
            
            // Load the model
            this.debug('Loading BodyPix model...');
            this.net = await window.bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            
            this.debug('BodyPix model loaded successfully');
            this.initialized = true;
            return true;
        } catch (error) {
            this.debug(`Error initializing BodyPix model: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Helper method to dynamically load TensorFlow.js script
     */
    async _loadTensorFlowScript() {
        if (window.tf) {
            this.debug('TensorFlow.js already loaded');
            return Promise.resolve();
        }

        this.debug('Loading TensorFlow.js script...');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js';
            script.async = true;
            script.onload = () => {
                this.debug('TensorFlow.js loaded successfully');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load TensorFlow.js script'));
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * Helper method to dynamically load the BodyPix script
     */
    async _loadBodyPixScript() {
        this.debug('Loading BodyPix script...');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.0/dist/body-pix.min.js';
            script.async = true;
            script.onload = () => {
                this.debug('BodyPix script loaded successfully');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load BodyPix script'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Process a video frame with BodyPix segmentation
     * @param {HTMLVideoElement} videoElement - The video element to process
     * @param {HTMLCanvasElement} canvas - The canvas to draw the output to
     * @param {string} backgroundType - Type of background effect
     * @param {HTMLImageElement} backgroundImage - Optional background image
     * @returns {Object} Performance metrics for the processed frame
     */
    async processFrame(videoElement, canvas, backgroundType, backgroundImage = null) {
        if (!this.initialized || !this.net) {
            return { segmentationTime: 0, totalTime: 0 };
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return { segmentationTime: 0, totalTime: 0 };
        
        // Ensure video is ready and has valid dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            this.debug('Video element has no dimensions, skipping frame processing');
            return { segmentationTime: 0, totalTime: 0 };
        }
        
        // Ensure canvas has proper dimensions
        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            this.debug(`Canvas resized to ${canvas.width}x${canvas.height}`);
        }
        
        const startTime = performance.now();
        let segmentationMask;
        
        try {
            // Perform person segmentation
            segmentationMask = await this.net.segmentPerson(videoElement, this.segmentationConfig);
            const segmentationTime = performance.now() - startTime;
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Apply effect based on background type
            if (backgroundType === 'blur') {
                await this._applyBlurBackground(videoElement, canvas, segmentationMask);
            } 
            else if (backgroundType === 'none') {
                // Just draw the video frame
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            }
            else {
                // Use image background
                this._applyImageBackground(videoElement, ctx, segmentationMask, backgroundImage);
            }
            
            const totalTime = performance.now() - startTime;
            
            return {
                segmentationTime,
                totalTime
            };
        } catch (error) {
            this.debug(`Error in BodyPix processFrame: ${error.message}`);
            // Fallback: just draw the video frame on error
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
    }

    /**
     * Apply blur background effect
     * @private
     */
    async _applyBlurBackground(videoElement, canvas, segmentationMask) {
        // Use BodyPix's built-in blur function
        await window.bodyPix.drawBokehEffect(
            canvas, 
            videoElement, 
            segmentationMask, 
            10, // blurAmount
            7   // edgeBlurAmount
        );
    }

    /**
     * Apply image background effect
     * @private
     */
    _applyImageBackground(videoElement, ctx, segmentationMask, backgroundImage) {
        const { width, height } = ctx.canvas;
        
        // Validate canvas dimensions
        if (width === 0 || height === 0) {
            this.debug('Canvas has invalid dimensions, cannot apply image background');
            ctx.drawImage(videoElement, 0, 0, width, height);
            return;
        }
        
        // Draw background image if available, or use black
        if (backgroundImage) {
            ctx.drawImage(backgroundImage, 0, 0, width, height);
        } else {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);
        }
        
        // Create a temporary canvas for the person
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // Ensure temp canvas has valid dimensions
        if (tempCanvas.width === 0 || tempCanvas.height === 0) {
            this.debug('Cannot create temp canvas with zero dimensions');
            // Fallback to just drawing the video without segmentation
            ctx.drawImage(videoElement, 0, 0, width, height);
            return;
        }
        
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            this.debug('Failed to get 2D context for temp canvas');
            ctx.drawImage(videoElement, 0, 0, width, height);
            return;
        }
        
        // Draw the person
        tempCtx.drawImage(videoElement, 0, 0, width, height);
        
        try {
            // Create ImageData from the mask
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Apply the mask: make background pixels transparent
            for (let i = 0; i < segmentationMask.data.length; i++) {
                // If this pixel is not a person (mask value is 0), make it transparent
                if (!segmentationMask.data[i]) {
                    const pixelIndex = i * 4;
                    data[pixelIndex + 3] = 0; // Set alpha to 0
                }
            }
            
            // Put the masked image data back to the temp canvas
            tempCtx.putImageData(imageData, 0, 0);
            
            // Draw the temp canvas onto the main canvas
            ctx.drawImage(tempCanvas, 0, 0);
        } catch (error) {
            this.debug(`Error in image background processing: ${error.message}`);
            // Fallback to just drawing the video
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(videoElement, 0, 0, width, height);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.net && typeof this.net.dispose === 'function') {
            try {
                this.net.dispose();
                this.initialized = false;
                this.net = null;
                this.debug('BodyPix model disposed');
            } catch (error) {
                this.debug(`Error disposing BodyPix model: ${error.message}`);
            }
        }
    }
}

export default BodyPixModel;