import BaseBackgroundModel from './BaseBackgroundModel.js';

class BodyPixModel extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        this.model = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            this.debugCallback('Loading BodyPix model...');
            // Load TensorFlow.js BodyPix model
            this.model = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            this.isInitialized = true;
            this.debugCallback('BodyPix model loaded successfully');
            return true;
        } catch (error) {
            this.debugCallback('Failed to load BodyPix model: ' + error.message);
            throw error;
        }
    }

    async processFrame(videoElement, canvasElement, backgroundType, backgroundImage) {
        const startTime = performance.now();
        const ctx = canvasElement.getContext('2d');
        
        // Get valid dimensions first
        const videoWidth = videoElement.videoWidth || 640;
        const videoHeight = videoElement.videoHeight || 480;
        
        // Ensure we have valid dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            this.debugCallback('BodyPix: Video has zero dimensions, using default dimensions');
            // Draw a placeholder or just fill the canvas
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvasElement.width || 640, canvasElement.height || 480);
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        // Ensure canvas has valid dimensions
        if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
            canvasElement.width = videoWidth;
            canvasElement.height = videoHeight;
            this.debugCallback(`BodyPix: Adjusted canvas to match video dimensions: ${canvasElement.width}x${canvasElement.height}`);
        }
        
        // Double check if canvas has valid dimensions
        if (canvasElement.width <= 0 || canvasElement.height <= 0) {
            canvasElement.width = videoWidth;
            canvasElement.height = videoHeight;
            this.debugCallback(`BodyPix: Force set canvas dimensions to ${videoWidth}x${videoHeight}`);
        }
        
        // Check if model is initialized
        if (!this.isInitialized || !this.model) {
            this.debugCallback('BodyPix: Model not initialized yet, drawing original video');
            // Directly draw the video element (not a canvas)
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        try {
            // Segment the person directly using the video element (not a canvas)
            const segmentation = await this.model.segmentPerson(videoElement, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.7
            });
            
            const segmentationTime = performance.now() - startTime;
            
            // Apply background based on selected type
            if (backgroundType === 'blur') {
                // Apply blur to the background
                await bodyPix.drawBokehEffect(
                    canvasElement, videoElement, segmentation, 15, 7, false);
                
                this.debugCallback('BodyPix: Applied blur effect');
                
            } else if (backgroundType === 'beach' || backgroundType === 'custom') {
                // Check if background image is available
                if (backgroundImage && backgroundImage.complete) {
                    // Draw background image
                    ctx.drawImage(backgroundImage, 0, 0, canvasElement.width, canvasElement.height);
                    
                    // Draw the person on top of the background
                    const foregroundColor = {r: 0, g: 0, b: 0, a: 0}; // transparent
                    const backgroundColor = {r: 0, g: 0, b: 0, a: 255}; // opaque
                    const backgroundDarkeningMask = bodyPix.toMask(
                        segmentation, foregroundColor, backgroundColor);
                    
                    // Create a temporary canvas for the person with guaranteed dimensions
                    const personCanvas = document.createElement('canvas');
                    personCanvas.width = canvasElement.width;
                    personCanvas.height = canvasElement.height;
                    const personCtx = personCanvas.getContext('2d');
                    
                    // Draw original video frame directly from video element
                    personCtx.drawImage(videoElement, 0, 0, personCanvas.width, personCanvas.height);
                    
                    // Apply mask
                    personCtx.globalCompositeOperation = 'destination-in';
                    personCtx.putImageData(backgroundDarkeningMask, 0, 0);
                    
                    // Draw the person on the canvas - ensure the person canvas has valid dimensions
                    if (personCanvas.width > 0 && personCanvas.height > 0) {
                        ctx.drawImage(personCanvas, 0, 0);
                        this.debugCallback(`BodyPix: Applied ${backgroundType} background`);
                    } else {
                        // Fallback if personCanvas is invalid
                        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                        this.debugCallback(`BodyPix: Invalid person canvas dimensions, falling back to video`);
                    }
                } else {
                    this.debugCallback(`Background image ${backgroundType} not loaded yet, using original video`);
                    // Just draw the original frame as fallback
                    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                }
            } else {
                // For any other case, just draw the original video
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            }
            
            const totalTime = performance.now() - startTime;
            return {
                segmentationTime: segmentationTime,
                totalTime: totalTime
            };
            
        } catch (error) {
            this.debugCallback('Error in BodyPix processing: ' + error.message);
            // Fallback to original frame
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
    }

    dispose() {
        // Clean up any TensorFlow resources if needed
        if (tf && tf.dispose) {
            tf.dispose();
            this.isInitialized = false;
            this.debugCallback('BodyPix model resources disposed');
        }
    }
}

export default BodyPixModel;