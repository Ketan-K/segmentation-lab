import BaseBackgroundModel from './BaseBackgroundModel.js';

class MediaPipeModel extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        this.segmenter = null;
        this.isInitialized = false;
        this.lastResults = null;
        this.processingFrame = false;
        this.loadingPromise = null;
        this.skippedFrames = 0;
        this.maxSkippedFrames = 1; // Skip every other frame for better performance
        this.bufferCanvas = null;
        this.isLowPowerMode = false;
        this.lastProcessingTime = 0;
    }

    async init() {
        try {
            this.debugCallback('Loading MediaPipe Selfie Segmentation model...');
            
            if (this.loadingPromise) {
                return this.loadingPromise;
            }
            
            // Create buffer canvas for optimization
            this.bufferCanvas = document.createElement('canvas');
            this.bufferCanvas.width = 640;
            this.bufferCanvas.height = 480;
            
            this.loadingPromise = new Promise(async (resolve, reject) => {
                try {
                    // Initialize MediaPipe model
                    const selfieSegmentation = new SelfieSegmentation({
                        locateFile: (file) => {
                            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                        }
                    });
                    
                    // Configure the model with optimized settings
                    selfieSegmentation.setOptions({
                        modelSelection: 0, // Use the general model (0) which is faster than landscape (1)
                        selfieMode: false, // Set to false to prevent mirroring
                    });
                    
                    // Set up the results callback
                    selfieSegmentation.onResults((results) => {
                        this.lastResults = results;
                        this.processingFrame = false;
                    });
                    
                    // Preload the model
                    await new Promise((modelResolve) => {
                        // Set a timeout to prevent infinite loading
                        const timeout = setTimeout(() => {
                            this.debugCallback('MediaPipe: Model preload timed out, continuing anyway');
                            modelResolve();
                        }, 5000);
                        
                        // Try to load a dummy image to initialize the model
                        const img = new Image();
                        img.onload = async () => {
                            try {
                                // Send a dummy image to initialize the model
                                await selfieSegmentation.send({image: img});
                                clearTimeout(timeout);
                                modelResolve();
                            } catch (err) {
                                this.debugCallback('MediaPipe: Preload error (not fatal): ' + err.message);
                                clearTimeout(timeout);
                                modelResolve(); // Continue despite error
                            }
                        };
                        img.onerror = () => {
                            this.debugCallback('MediaPipe: Failed to load dummy image, continuing anyway');
                            clearTimeout(timeout);
                            modelResolve();
                        };
                        // Use a small 1x1 pixel image for initialization
                        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
                    });
                    
                    this.segmenter = selfieSegmentation;
                    this.isInitialized = true;
                    
                    // Enable adaptive performance mode
                    this._setupAdaptivePerformance();
                    
                    this.debugCallback('MediaPipe Selfie Segmentation model loaded successfully');
                    resolve(true);
                } catch (error) {
                    this.debugCallback('Failed to load MediaPipe model: ' + error.message);
                    this.isInitialized = false;
                    reject(error);
                }
            });
            
            return this.loadingPromise;
        } catch (error) {
            this.debugCallback('Failed to load MediaPipe model: ' + error.message);
            throw error;
        }
    }
    
    _setupAdaptivePerformance() {
        // Set up adaptive performance monitoring
        setInterval(() => {
            // If last processing time is too high, enable low power mode
            if (this.lastProcessingTime > 33) { // More than 30 FPS
                if (!this.isLowPowerMode) {
                    this.isLowPowerMode = true;
                    this.maxSkippedFrames = 2; // Skip 2 frames
                    // Remove verbose logging
                }
            } else if (this.lastProcessingTime < 20) { // Less than 20 ms per frame
                if (this.isLowPowerMode) {
                    this.isLowPowerMode = false;
                    this.maxSkippedFrames = 1; // Skip 1 frame
                    // Remove verbose logging
                }
            }
        }, 5000); // Check every 5 seconds
    }

    async processFrame(videoElement, canvasElement, backgroundType, backgroundImage) {
        const startTime = performance.now();
        const ctx = canvasElement.getContext('2d');
        
        // Ensure canvas dimensions match video
        if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
            canvasElement.width = videoElement.videoWidth || 640;
            canvasElement.height = videoElement.videoHeight || 480;
            
            // Also update buffer canvas size
            this.bufferCanvas.width = canvasElement.width;
            this.bufferCanvas.height = canvasElement.height;
        }
        
        if (!this.isInitialized || !this.segmenter) {
            this.debugCallback('MediaPipe model not initialized yet');
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        // Skip frames for better performance if needed
        if (this.skippedFrames < this.maxSkippedFrames) {
            this.skippedFrames++;
            
            // If we have previous results, use them instead of dropping frame entirely
            if (this.lastResults) {
                this._drawResultsWithBackground(ctx, videoElement, this.lastResults, backgroundType, backgroundImage, canvasElement);
            } else {
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            }
            
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        // Reset frame skip counter
        this.skippedFrames = 0;
        
        // If already processing a frame, reuse the last results
        if (this.processingFrame) {
            if (this.lastResults) {
                this._drawResultsWithBackground(ctx, videoElement, this.lastResults, backgroundType, backgroundImage, canvasElement);
            } else {
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            }
            
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        try {
            // Mark as processing
            this.processingFrame = true;
            
            // Use the buffer canvas for more efficient processing
            const bufferCtx = this.bufferCanvas.getContext('2d');
            
            // Draw video with flip to counter the selfieMode:false setting
            bufferCtx.save();
            bufferCtx.scale(-1, 1);
            bufferCtx.drawImage(videoElement, -this.bufferCanvas.width, 0, this.bufferCanvas.width, this.bufferCanvas.height);
            bufferCtx.restore();
            
            // Process the frame with MediaPipe - use the buffer canvas as input
            await this.segmenter.send({image: this.bufferCanvas});
            
            // Small timeout to avoid WASM memory issues
            await new Promise(resolve => setTimeout(resolve, 5));
            
            const segmentationTime = performance.now() - startTime;
            
            // If no results are available, use the last known results or fall back to the original video
            if (!this.lastResults) {
                this.debugCallback('No MediaPipe results available yet');
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                this.processingFrame = false;
                return {
                    segmentationTime: 0,
                    totalTime: performance.now() - startTime
                };
            }
            
            // Draw the results with background
            this._drawResultsWithBackground(ctx, videoElement, this.lastResults, backgroundType, backgroundImage, canvasElement);
            
            const totalTime = performance.now() - startTime;
            this.lastProcessingTime = totalTime;
            
            // Reset processing flag
            this.processingFrame = false;
            
            return {
                segmentationTime: segmentationTime,
                totalTime: totalTime
            };
            
        } catch (error) {
            this.debugCallback('Error in MediaPipe processing: ' + error.message);
            this.processingFrame = false;
            
            // Fallback to original frame
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
    }
    
    _drawResultsWithBackground(ctx, videoElement, results, backgroundType, backgroundImage, canvasElement) {
        // Apply background based on selected type
        if (backgroundType === 'blur') {
            // First draw the blurred background
            ctx.save();
            ctx.filter = 'blur(15px)';
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            ctx.filter = 'none';
            
            // Then draw only the person on top
            const personCtx = this.bufferCanvas.getContext('2d');
            personCtx.clearRect(0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
            
            // Draw the person from the original video
            personCtx.save();
            personCtx.drawImage(videoElement, 0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
            
            // Use the mask to extract just the person
            personCtx.globalCompositeOperation = 'destination-in';
            personCtx.scale(-1, 1);
            personCtx.drawImage(results.segmentationMask, -this.bufferCanvas.width, 0, this.bufferCanvas.width, this.bufferCanvas.height);
            personCtx.restore();
            
            // Draw the person on top of the blurred background
            ctx.drawImage(this.bufferCanvas, 0, 0);
            ctx.restore();
            
            // No need to log everyday operations
            
        } else if (backgroundType === 'beach' || backgroundType === 'office' || backgroundType === 'custom') {
            // Check if background image is available
            if (backgroundImage && backgroundImage.complete) {
                // First draw the background image
                ctx.save();
                ctx.drawImage(backgroundImage, 0, 0, canvasElement.width, canvasElement.height);
                
                // Then draw only the person on top
                const personCtx = this.bufferCanvas.getContext('2d');
                personCtx.clearRect(0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
                
                // Draw the person from the original video
                personCtx.save();
                personCtx.drawImage(videoElement, 0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
                
                // Use the mask to extract just the person
                personCtx.globalCompositeOperation = 'destination-in';
                personCtx.scale(-1, 1);
                personCtx.drawImage(results.segmentationMask, -this.bufferCanvas.width, 0, this.bufferCanvas.width, this.bufferCanvas.height);
                personCtx.restore();
                
                // Draw the person on top of the background image
                ctx.drawImage(this.bufferCanvas, 0, 0);
                ctx.restore();
                
                // No need to log everyday operations
            } else {
                // If image isn't loaded yet, show a message and fall back to original video
                this.debugCallback(`MediaPipe: Background image for ${backgroundType} not ready yet`);
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            }
        } else {
            // Just draw the original video for 'none' option
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        }
    }

    dispose() {
        if (this.segmenter) {
            try {
                this.segmenter.close();
            } catch (error) {
                this.debugCallback('Error closing MediaPipe model: ' + error.message);
            }
            this.segmenter = null;
            this.lastResults = null;
            this.isInitialized = false;
            this.processingFrame = false;
            this.loadingPromise = null;
            this.skippedFrames = 0;
            this.isLowPowerMode = false;
            // No need to log everyday operations
        }
    }
}

export default MediaPipeModel;