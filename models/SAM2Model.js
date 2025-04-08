import BaseBackgroundModel from './BaseBackgroundModel.js';

class SAM2Model extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        this.model = null;
        this.ort = null;
        this.session = null;
        this.isModelReady = false;
        this.preprocessTensor = null;
        this.modelResolution = 1024; // Default SAM2 resolution
    }

    // Initialize the SAM2 model
    async init() {
        try {
            this.debugCallback('Loading SAM2 model...');
            
            // Load ONNX Runtime web
            if (!this.ort) {
                this.ort = await import('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.15.0/dist/ort.min.js');
                this.debugCallback('ONNX Runtime loaded');
            }
            
            // Initialize model session
            if (!this.session) {
                // Set path to the model file - in a real app, you'd host this file
                const modelPath = '/models/sam2_vit_b_quantized.onnx';
                
                // Set execution providers and other options
                const options = {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                };
                
                try {
                    this.session = await this.ort.InferenceSession.create(modelPath, options);
                    this.debugCallback('SAM2 model loaded successfully');
                    this.isModelReady = true;
                } catch (e) {
                    this.debugCallback('Failed to load actual model, falling back to simulation mode');
                    // Fallback to simulation mode
                    this.isModelReady = false;
                    // Create a simulated model for development/testing
                    this.model = {
                        segment: this.simulateSegmentation.bind(this)
                    };
                }
            }
            
            return true;
        } catch (error) {
            this.debugCallback('Failed to load SAM2 model: ' + error.message);
            return false;
        }
    }

    // Simulated segmentation for development/testing
    async simulateSegmentation(imageData) {
        // Create a simulated mask (would be replaced with actual SAM2 segmentation)
        const width = imageData.width;
        const height = imageData.height;
        const mask = new Uint8Array(width * height);
        
        // Simple person detection - detect central area as person
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDist = Math.min(width, height) * 0.4; // 40% of smaller dimension
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                mask[y * width + x] = dist < maxDist ? 1 : 0; // 1 for person, 0 for background
            }
        }
        
        return mask;
    }

    // Preprocess image for SAM2 model
    async preprocessImage(imageData) {
        const { width, height } = imageData;
        
        // Create a temporary canvas for preprocessing
        const canvas = document.createElement('canvas');
        canvas.width = this.modelResolution;
        canvas.height = this.modelResolution;
        const ctx = canvas.getContext('2d');
        
        // Calculate aspect ratio preserving resize
        const scale = Math.min(
            this.modelResolution / width,
            this.modelResolution / height
        );
        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);
        const offsetX = Math.floor((this.modelResolution - scaledWidth) / 2);
        const offsetY = Math.floor((this.modelResolution - scaledHeight) / 2);
        
        // Clear canvas and draw resized image
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.modelResolution, this.modelResolution);
        
        // Create a temporary canvas with original dimensions
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw resized image centered on black background
        ctx.drawImage(
            tempCanvas,
            0, 0, width, height,
            offsetX, offsetY, scaledWidth, scaledHeight
        );
        
        // Get processed image data
        const processedImageData = ctx.getImageData(
            0, 0, this.modelResolution, this.modelResolution
        );
        
        // Convert to normalized RGB tensor
        const tensor = new Float32Array(this.modelResolution * this.modelResolution * 3);
        
        for (let i = 0; i < processedImageData.data.length / 4; i++) {
            const r = processedImageData.data[i * 4] / 255;
            const g = processedImageData.data[i * 4 + 1] / 255;
            const b = processedImageData.data[i * 4 + 2] / 255;
            
            // Store in RGB order (model input format)
            tensor[i] = r;
            tensor[i + this.modelResolution * this.modelResolution] = g;
            tensor[i + 2 * this.modelResolution * this.modelResolution] = b;
        }
        
        return {
            tensor,
            scale,
            offsetX,
            offsetY
        };
    }

    // Run inference with SAM2 model
    async runInference(preprocessedData) {
        if (!this.isModelReady) {
            return this.simulateSegmentation({
                width: this.modelResolution,
                height: this.modelResolution
            });
        }
        
        try {
            // Create input tensor
            const inputTensor = new this.ort.Tensor(
                'float32',
                preprocessedData.tensor,
                [1, 3, this.modelResolution, this.modelResolution]
            );
            
            // Point prompt in the middle of the image (assume subject is centered)
            const pointPrompt = new this.ort.Tensor(
                'float32',
                new Float32Array([this.modelResolution/2, this.modelResolution/2]),
                [1, 1, 2]
            );
            
            // Create point labels (1 for foreground)
            const pointLabels = new this.ort.Tensor(
                'float32',
                new Float32Array([1]),
                [1, 1]
            );
            
            // Create input feeds
            const feeds = {
                'image': inputTensor,
                'point_coords': pointPrompt,
                'point_labels': pointLabels
            };
            
            // Run model
            const results = await this.session.run(feeds);
            
            // Get mask prediction (sigmoid of logits)
            const maskLogits = results.masks.data;
            const maskPrediction = new Uint8Array(maskLogits.length);
            
            // Apply sigmoid and threshold
            for (let i = 0; i < maskLogits.length; i++) {
                const sigmoid = 1 / (1 + Math.exp(-maskLogits[i]));
                maskPrediction[i] = sigmoid > 0.5 ? 1 : 0;
            }
            
            return maskPrediction;
        } catch (error) {
            this.debugCallback('Error during inference: ' + error.message);
            return this.simulateSegmentation({
                width: this.modelResolution,
                height: this.modelResolution
            });
        }
    }

    // Post-process mask to original dimensions
    postprocessMask(mask, width, height, preprocessData) {
        const { scale, offsetX, offsetY } = preprocessData;
        const result = new Uint8Array(width * height);
        
        // Fill with background (0)
        result.fill(0);
        
        // Map mask back to original dimensions
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Calculate corresponding position in model resolution
                const modelX = Math.floor(x * scale) + offsetX;
                const modelY = Math.floor(y * scale) + offsetY;
                
                // Check bounds
                if (modelX >= 0 && modelX < this.modelResolution && 
                    modelY >= 0 && modelY < this.modelResolution) {
                    // Get mask value at model resolution
                    const maskIdx = modelY * this.modelResolution + modelX;
                    // Set result value
                    result[y * width + x] = mask[maskIdx];
                }
            }
        }
        
        return result;
    }

    // Process a frame with SAM2 segmentation
    async processFrame(videoElement, canvas, backgroundType, backgroundImage) {
        const startTime = performance.now();
        const context = canvas.getContext('2d');
        const { width, height } = canvas;
        
        try {
            // Get the frame data
            context.drawImage(videoElement, 0, 0, width, height);
            const imageData = context.getImageData(0, 0, width, height);
            
            // Preprocess image
            const preprocessedData = await this.preprocessImage(imageData);
            
            // Run segmentation
            const modelMask = await this.runInference(preprocessedData);
            
            // Post-process to original dimensions
            const mask = this.postprocessMask(modelMask, width, height, preprocessedData);
            
            const segTime = performance.now() - startTime;
            
            // Apply background based on selected type
            if (backgroundType === 'blur') {
                // Apply blur effect
                this.applyBlurBackground(imageData, mask, context);
                this.debugCallback('SAM2: Applied blur effect');
                
            } else if (backgroundType === 'beach' || backgroundType === 'custom') {
                // Apply image background
                this.applyImageBackground(videoElement, canvas, mask, backgroundImage);
                this.debugCallback(`SAM2: Applied ${backgroundType} background`);
            }
            
            const totalTime = performance.now() - startTime;
            return { segmentationTime: segTime, totalTime: totalTime };
            
        } catch (error) {
            this.debugCallback('Error applying SAM2 background: ' + error.message);
            // Fallback to drawing original frame
            context.drawImage(videoElement, 0, 0, width, height);
            return { segmentationTime: 0, totalTime: performance.now() - startTime };
        }
    }

    // Apply blur background effect
    applyBlurBackground(imageData, mask, context) {
        const { width, height } = imageData;
        const pixels = imageData.data;
        const blurRadius = 15;
        
        // Create a blurred copy of the image
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = width;
        blurCanvas.height = height;
        const blurCtx = blurCanvas.getContext('2d');
        
        // Draw and blur
        blurCtx.putImageData(imageData, 0, 0);
        blurCtx.filter = `blur(${blurRadius}px)`;
        blurCtx.drawImage(blurCanvas, 0, 0);
        
        // Get blurred image data
        const blurredData = blurCtx.getImageData(0, 0, width, height).data;
        
        // Apply mask - keep person pixels, use blurred pixels for background
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 0) { // Background pixel
                const pixelIdx = i * 4;
                pixels[pixelIdx] = blurredData[pixelIdx];
                pixels[pixelIdx + 1] = blurredData[pixelIdx + 1];
                pixels[pixelIdx + 2] = blurredData[pixelIdx + 2];
            }
        }
        
        context.putImageData(imageData, 0, 0);
    }
    
    // Apply image background effect
    applyImageBackground(videoElement, canvas, mask, backgroundImage) {
        const { width, height } = canvas;
        const context = canvas.getContext('2d');
        
        // Check if background image is available
        if (backgroundImage && backgroundImage.complete) {
            // Clear canvas and draw background image
            context.clearRect(0, 0, width, height);
            context.drawImage(backgroundImage, 0, 0, width, height);
            
            // Create a temporary canvas for the person
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the original video frame
            tempCtx.drawImage(videoElement, 0, 0, width, height);
            
            // Apply mask
            const imageData = tempCtx.getImageData(0, 0, width, height);
            const pixels = imageData.data;
            
            for (let i = 0; i < mask.length; i++) {
                if (mask[i] === 0) { // Background pixel
                    const pixelIdx = i * 4;
                    pixels[pixelIdx + 3] = 0; // Set alpha to 0 (transparent)
                }
            }
            
            tempCtx.putImageData(imageData, 0, 0);
            
            // Draw the masked person on top of the background
            context.drawImage(tempCanvas, 0, 0);
        } else {
            this.debugCallback('Background image not loaded yet, using original video');
            // Just draw the original frame as fallback
            context.drawImage(videoElement, 0, 0, width, height);
        }
    }

    // Clean up resources
    dispose() {
        if (this.session) {
            this.session.dispose();
            this.session = null;
        }
        this.isModelReady = false;
        this.debugCallback('SAM2 model resources released');
    }
}

export default SAM2Model;