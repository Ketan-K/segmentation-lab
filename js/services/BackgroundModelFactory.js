/**
 * Factory class for creating different background segmentation models
 * Detects hardware capabilities and creates the most suitable model
 * Also supports manual selection for lab/testing environment
 */

class BackgroundModelFactory {
    constructor(debugCallback) {
        this.debugCallback = debugCallback || console.log;
        this.simdSupport = false;
        this.webglSupport = false;
        this.webgl2Support = false;
        this.devicePerformance = 'unknown'; // 'low', 'medium', 'high'
        
        // Available models and their configurations
        this.availableModels = {
            mediapipe: {
                name: 'MediaPipe',
                description: 'Google MediaPipe Selfie Segmentation',
                isImplemented: true
            },
            bodypix: {
                name: 'BodyPix',
                description: 'TensorFlow.js BodyPix (640x360, ~11 FPS)',
                isImplemented: true
            },
            mlkit: {
                name: 'ML Kit',
                variants: [
                    { name: 'ML Kit WebAssembly', resolution: '256x256', simdRequired: false, fps: '~9 FPS' },
                    { name: 'ML Kit WebAssembly SIMD', resolution: '256x256', simdRequired: true, fps: '~17-19 FPS' }
                ],
                isImplemented: false
            },
            meet: {
                name: 'Google Meet',
                variants: [
                    { name: 'Meet 256x144', resolution: '256x144', simdRequired: false, fps: '~14-16 FPS', backend: 'Canvas 2D + CPU' },
                    { name: 'Meet 256x144 WebGL', resolution: '256x144', simdRequired: false, fps: '~16 FPS', backend: 'WebGL 2' },
                    { name: 'Meet 256x144 SIMD', resolution: '256x144', simdRequired: true, fps: '~26 FPS', backend: 'Canvas 2D + CPU' },
                    { name: 'Meet 256x144 SIMD WebGL', resolution: '256x144', simdRequired: true, fps: '~31 FPS', backend: 'WebGL 2' },
                    { name: 'Meet 160x96', resolution: '160x96', simdRequired: false, fps: '~29-35 FPS' },
                    { name: 'Meet 160x96 SIMD', resolution: '160x96', simdRequired: true, fps: '~48-60 FPS' }
                ],
                isImplemented: false
            }
        };
        
        // User's preferred model selection
        this.userPreferredModel = null;
        this.userPreferredConfig = null;
    }

    /**
     * Initialize the factory by detecting hardware capabilities
     */
    async init() {
        this.debugCallback('Initializing BackgroundModelFactory...');
        
        // Detect SIMD support
        this.simdSupport = await this._detectSIMDSupport();
        this.debugCallback(`WebAssembly SIMD support: ${this.simdSupport ? 'Yes' : 'No'}`);
        
        // Detect WebGL support
        this.webglSupport = this._detectWebGLSupport();
        this.debugCallback(`WebGL support: ${this.webglSupport ? 'Yes' : 'No'}`);
        
        // Detect WebGL 2 support
        this.webgl2Support = this._detectWebGL2Support();
        this.debugCallback(`WebGL 2 support: ${this.webgl2Support ? 'Yes' : 'No'}`);
        
        // Estimate device performance
        await this._estimateDevicePerformance();
        this.debugCallback(`Estimated device performance: ${this.devicePerformance}`);
        
        return true;
    }

    /**
     * Create a background model instance based on model type and hardware capabilities
     * @param {string} modelType - Type of model to create ('mediapipe', 'bodypix', 'mlkit', 'meet')
     * @param {Object} options - Additional options for model creation
     * @returns {BaseBackgroundModel} The created model instance
     */
    async createModel(modelType = 'auto', options = {}) {
        // If user has a preferred model, use that instead
        if (this.userPreferredModel && modelType === 'auto') {
            modelType = this.userPreferredModel;
            options = this.userPreferredConfig || {};
            this.debugCallback(`Using user preferred model: ${modelType}`);
        }
        
        this.debugCallback(`Creating background model: ${modelType} with options:`, options);
        
        // If auto, select the optimal model based on device capabilities
        if (modelType === 'auto') {
            modelType = this._selectOptimalModel();
            this.debugCallback(`Auto-selected model: ${modelType}`);
        }
        
        // Import the appropriate model dynamically
        try {
            switch (modelType.toLowerCase()) {
                case 'mediapipe':
                    const MediaPipeModel = (await import('../../models/MediaPipeModel.js')).default;
                    return new MediaPipeModel(this.debugCallback);
                    
                case 'bodypix':
                    const BodyPixModel = (await import('../../models/BodyPixModel.js')).default;
                    return new BodyPixModel(this.debugCallback);
                    
                // Future models would be added here
                
                default:
                    this.debugCallback(`Unknown model type: ${modelType}, falling back to MediaPipe`);
                    const FallbackModel = (await import('../../models/MediaPipeModel.js')).default;
                    return new FallbackModel(this.debugCallback);
            }
        } catch (error) {
            this.debugCallback(`Error creating model ${modelType}: ${error.message}`);
            // Fallback to MediaPipe if available
            try {
                const FallbackModel = (await import('../../models/MediaPipeModel.js')).default;
                return new FallbackModel(this.debugCallback);
            } catch (e) {
                this.debugCallback(`Could not create fallback model either: ${e.message}`);
                return null;
            }
        }
    }
    
    /**
     * Detect if the browser supports WebAssembly SIMD
     * @private
     * @returns {Promise<boolean>} True if SIMD is supported
     */
    async _detectSIMDSupport() {
        try {
            // Feature detection for SIMD
            return WebAssembly.validate(new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60,
                0x00, 0x01, 0x7b, 0x03, 0x02, 0x01, 0x00, 0x07, 0x05, 0x01, 0x01, 0x73,
                0x00, 0x00, 0x0a, 0x08, 0x01, 0x06, 0x00, 0xfd, 0x0c, 0x00, 0x0b
            ]));
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Detect if the browser supports WebGL
     * @private
     * @returns {boolean} True if WebGL is supported
     */
    _detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Detect if the browser supports WebGL 2
     * @private
     * @returns {boolean} True if WebGL 2 is supported
     */
    _detectWebGL2Support() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Estimate the performance capabilities of the device
     * @private
     */
    async _estimateDevicePerformance() {
        // Simple heuristic based on hardware concurrency (CPU cores)
        const cores = navigator.hardwareConcurrency || 1;
        
        // Check if device is mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (cores >= 8 && this.webgl2Support && !isMobile) {
            this.devicePerformance = 'high';
        } else if (cores >= 4 && this.webglSupport) {
            this.devicePerformance = 'medium';
        } else {
            this.devicePerformance = 'low';
        }
        
        // Run a simple benchmark to refine the estimate
        await this._runSimpleBenchmark();
    }
    
    /**
     * Run a simple benchmark to estimate device performance
     * @private
     */
    async _runSimpleBenchmark() {
        try {
            const start = performance.now();
            
            // Simple compute benchmark
            let result = 0;
            for (let i = 0; i < 1000000; i++) {
                result += Math.sqrt(i);
            }
            
            const end = performance.now();
            const benchmarkTime = end - start;
            
            // Refine performance estimate based on benchmark
            if (benchmarkTime < 50) {
                this.devicePerformance = 'high';
            } else if (benchmarkTime < 200) {
                this.devicePerformance = 'medium';
            } else {
                this.devicePerformance = 'low';
            }
            
            this.debugCallback(`Performance benchmark completed in ${benchmarkTime.toFixed(2)}ms: ${this.devicePerformance}`);
        } catch (e) {
            this.debugCallback(`Error running benchmark: ${e.message}`);
        }
    }
    
    /**
     * Select the optimal model based on device capabilities
     * @private
     * @returns {string} The selected model type
     */
    _selectOptimalModel() {
        if (this.devicePerformance === 'high' && this.simdSupport) {
            return 'mediapipe';  // For now, return MediaPipe for high-end devices
        } else if (this.devicePerformance === 'medium') {
            return 'mediapipe';  // MediaPipe works well on medium devices
        } else {
            // For low-end devices, bodypix might actually be better sometimes
            // due to more efficient downscaling
            return 'mediapipe'; 
        }
    }

    /**
     * Set the user's preferred background model
     * @param {string} modelType - Type of model to use ('mediapipe', 'bodypix', etc.)
     * @param {Object} config - Configuration options for the model
     */
    setUserPreferredModel(modelType, config = {}) {
        // Validate if the model is available
        if (!this.availableModels[modelType.toLowerCase()]) {
            this.debugCallback(`Model ${modelType} not found in available models`);
            return false;
        }
        
        // Check if the model is implemented
        if (!this.availableModels[modelType.toLowerCase()].isImplemented) {
            this.debugCallback(`Model ${modelType} is not implemented yet`);
            return false;
        }
        
        // Check if the model requires SIMD but the browser doesn't support it
        if (config.simdRequired && !this.simdSupport) {
            this.debugCallback(`Model ${modelType} requires SIMD but browser doesn't support it`);
            return false;
        }
        
        // Save user preference
        this.userPreferredModel = modelType.toLowerCase();
        this.userPreferredConfig = config;
        this.debugCallback(`User preferred model set to ${modelType}`);
        
        return true;
    }
    
    /**
     * Reset user's preferred model back to auto-selection
     */
    resetUserPreferredModel() {
        this.userPreferredModel = null;
        this.userPreferredConfig = null;
        this.debugCallback('User preferred model reset to auto');
        return true;
    }
    
    /**
     * Get a list of all available models with their details
     * @returns {Array} Array of model objects with name, description, isImplemented, etc.
     */
    getAvailableModels() {
        const models = [];
        
        for (const [id, model] of Object.entries(this.availableModels)) {
            const modelInfo = {
                id,
                name: model.name,
                description: model.description,
                isImplemented: model.isImplemented
            };
            
            if (model.variants) {
                modelInfo.variants = model.variants.map(variant => {
                    // Check if this variant is compatible with the current device
                    const isCompatible = !(variant.simdRequired && !this.simdSupport);
                    let incompatibilityReason = null;
                    
                    if (variant.simdRequired && !this.simdSupport) {
                        incompatibilityReason = 'SIMD required but not supported by browser';
                    }
                    
                    return {
                        ...variant,
                        isCompatible,
                        incompatibilityReason
                    };
                });
            }
            
            models.push(modelInfo);
        }
        
        return models;
    }
    
    /**
     * Get current device capabilities and performance estimate
     * @returns {Object} Device capabilities
     */
    getDeviceCapabilities() {
        return {
            simdSupport: this.simdSupport,
            webglSupport: this.webglSupport,
            webgl2Support: this.webgl2Support,
            devicePerformance: this.devicePerformance,
            cores: navigator.hardwareConcurrency || 'unknown',
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            preferredModel: this.userPreferredModel,
            recommendedModel: this._selectOptimalModel()
        };
    }
}

export default BackgroundModelFactory;