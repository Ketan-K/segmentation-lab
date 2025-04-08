import BaseBackgroundModel from './BaseBackgroundModel.js';

class WebGLModel extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        
        this.isInitialized = false;
        this.glCanvas = null;
        this.gl = null;
        this.program = null;
        this.segmentationTexture = null;
        this.frameTexture = null;
        this.backgroundTexture = null;
        this.textures = {};
        this.positionLocation = null;
        this.texCoordLocation = null;
        this.imageLocation = null;
        this.backgroundLocation = null;
        this.thresholdLocation = null;
    }

    async init() {
        try {
            // Create a WebGL canvas for processing
            this.glCanvas = document.createElement('canvas');
            this.glCanvas.width = 640;
            this.glCanvas.height = 480;
            
            // Initialize WebGL context
            this.gl = this.glCanvas.getContext('webgl', { premultipliedAlpha: false });
            
            if (!this.gl) {
                this.debugCallback('WebGL not supported');
                return false;
            }
            
            // Set up program and shaders
            this.program = this.createProgram(this.gl);
            this.setupVertexShaderInputs(this.gl, this.program);
            this.setupTextures(this.gl);
            
            this.isInitialized = true;
            this.debugCallback('WebGL model initialized successfully');
            return true;
        } catch (error) {
            this.debugCallback('Error initializing WebGL model: ' + error.message);
            return false;
        }
    }
    
    createProgram(gl) {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            
            uniform sampler2D u_image;
            uniform sampler2D u_background;
            uniform float u_threshold;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 frameColor = texture2D(u_image, v_texCoord);
                vec4 bgColor = texture2D(u_background, v_texCoord);
                
                // Simple color-based segmentation
                float gray = dot(frameColor.rgb, vec3(0.299, 0.587, 0.114));
                float alpha = step(u_threshold, gray);
                
                // Mix based on segmentation
                gl_FragColor = mix(bgColor, frameColor, alpha);
            }
        `;
        
        // Create shaders
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Create program
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            throw new Error('Could not compile WebGL program: ' + info);
        }
        
        return program;
    }
    
    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Error compiling shader: ' + info);
        }
        
        return shader;
    }
    
    setupVertexShaderInputs(gl, program) {
        // Set up rectangle covering the entire canvas
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0,
        ]), gl.STATIC_DRAW);
        
        // Set up texture coordinates
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
        ]), gl.STATIC_DRAW);
        
        // Get attribute locations
        this.positionLocation = gl.getAttribLocation(program, "a_position");
        this.texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
        
        // Get uniform locations
        this.imageLocation = gl.getUniformLocation(program, "u_image");
        this.backgroundLocation = gl.getUniformLocation(program, "u_background");
        this.thresholdLocation = gl.getUniformLocation(program, "u_threshold");
    }
    
    setupTextures(gl) {
        // Create a texture for the video frame
        this.frameTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Create a texture for the background
        this.backgroundTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Initialize with a 1x1 transparent pixel
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
                     new Uint8Array([0, 0, 0, 255]));
    }
    
    async processFrame(videoElement, canvasElement, backgroundType, backgroundImage) {
        const startTime = performance.now();
        
        if (!this.isInitialized) {
            this.debugCallback('WebGL model not initialized');
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
        
        try {
            // Adjust GL canvas size to match video/canvas
            if (this.glCanvas.width !== videoElement.videoWidth || 
                this.glCanvas.height !== videoElement.videoHeight) {
                this.glCanvas.width = videoElement.videoWidth || 640;
                this.glCanvas.height = videoElement.videoHeight || 480;
                this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
            }
            
            // Ensure canvas has right dimensions too
            if (canvasElement.width !== videoElement.videoWidth || 
                canvasElement.height !== videoElement.videoHeight) {
                canvasElement.width = videoElement.videoWidth || 640;
                canvasElement.height = videoElement.videoHeight || 480;
            }
            
            // Start with simple segmentation timing
            const segmentationStartTime = performance.now();
            
            // Use the WebGL program
            this.gl.useProgram(this.program);
            
            // Set up the position attribute
            this.gl.enableVertexAttribArray(this.positionLocation);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                 1.0,  1.0,
            ]), this.gl.STATIC_DRAW);
            this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);
            
            // Set up the texture coordinate attribute
            this.gl.enableVertexAttribArray(this.texCoordLocation);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                1.0, 1.0,
            ]), this.gl.STATIC_DRAW);
            this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
            
            // Bind video texture to texture unit 0
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, videoElement);
            this.gl.uniform1i(this.imageLocation, 0);
            
            // Set threshold for segmentation
            this.gl.uniform1f(this.thresholdLocation, 0.3);
            
            // Handle background texture based on type
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.backgroundTexture);
            this.gl.uniform1i(this.backgroundLocation, 1);
            
            if (backgroundType === 'blur') {
                // For blur, we create a blurred version of the video
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = this.glCanvas.width;
                tempCanvas.height = this.glCanvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Draw the video
                tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // Apply CSS blur
                tempCtx.filter = 'blur(15px)';
                tempCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // Use as background texture
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, tempCanvas);
                
            } else if ((backgroundType === 'beach' || backgroundType === 'office' || backgroundType === 'custom') && 
                       backgroundImage && backgroundImage.complete) {
                // Use provided background image
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, backgroundImage);
            } else {
                // For no background or if image isn't loaded
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, videoElement);
            }
            
            // Draw the rectangle with the shader program
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            
            // Measure segmentation time
            const segmentationTime = performance.now() - segmentationStartTime;
            
            // Copy the result to the output canvas
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(this.glCanvas, 0, 0, canvasElement.width, canvasElement.height);
            
            // Calculate total processing time
            const totalTime = performance.now() - startTime;
            
            return {
                segmentationTime: segmentationTime,
                totalTime: totalTime
            };
        } catch (error) {
            this.debugCallback('Error in WebGL processing: ' + error.message);
            
            // Fallback to drawing the original video
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            
            return {
                segmentationTime: 0,
                totalTime: performance.now() - startTime
            };
        }
    }
    
    dispose() {
        if (this.gl) {
            // Clean up WebGL resources
            
            // Delete textures
            this.gl.deleteTexture(this.frameTexture);
            this.gl.deleteTexture(this.backgroundTexture);
            
            // Delete program and shaders
            if (this.program) {
                // Get attached shaders
                const shaders = this.gl.getAttachedShaders(this.program);
                if (shaders) {
                    for (const shader of shaders) {
                        this.gl.deleteShader(shader);
                    }
                }
                this.gl.deleteProgram(this.program);
            }
            
            this.isInitialized = false;
        }
    }
}

export default WebGLModel;