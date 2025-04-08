import BaseBackgroundModel from './BaseBackgroundModel.js';

class WebGLModel extends BaseBackgroundModel {
    constructor(debugCallback) {
        super(debugCallback);
        this.program = null;
        this.gl = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.backgroundTexture = null;
        this.videoTexture = null;
        this.vertexShader = null;
        this.fragmentShader = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            this.debugCallback('Initializing WebGL model...');
            
            // Create a temporary canvas to initialize WebGL
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 640;
            tempCanvas.height = 480;
            
            // Get WebGL context
            this.gl = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }
            
            // Create shaders
            this.vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
                attribute vec2 a_position;
                attribute vec2 a_texCoord;
                varying vec2 v_texCoord;
                void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texCoord = a_texCoord;
                }
            `);
            
            // Fixed fragment shader - correcting the type issue with greenScreen
            this.fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
                precision mediump float;
                uniform sampler2D u_video;
                uniform sampler2D u_background;
                uniform vec4 u_colorThreshold;
                varying vec2 v_texCoord;
                
                void main() {
                    vec4 videoColor = texture2D(u_video, v_texCoord);
                    vec4 bgColor = texture2D(u_background, v_texCoord);
                    
                    // Simple green screen effect - using floating point comparisons
                    float isGreenDominant1 = step(u_colorThreshold.x * videoColor.r, videoColor.g);
                    float isGreenDominant2 = step(u_colorThreshold.y * videoColor.b, videoColor.g);
                    float isGreenAboveThreshold = step(u_colorThreshold.z, videoColor.g);
                    
                    // Combine all conditions (multiplication is like logical AND for values 0 and 1)
                    float greenScreen = isGreenDominant1 * isGreenDominant2 * isGreenAboveThreshold;
                    
                    // Apply smoothing to the edges
                    float smoothingFactor = u_colorThreshold.w;
                    float alpha = smoothstep(0.0, smoothingFactor, 1.0 - greenScreen);
                    
                    gl_FragColor = mix(bgColor, videoColor, alpha);
                }
            `);
            
            // Create program
            this.program = this.createProgram(this.vertexShader, this.fragmentShader);
            this.gl.useProgram(this.program);
            
            // Lookup attributes and uniforms
            const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
            const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
            
            // Create buffers
            this.positionBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            
            // Rectangle covering the entire canvas
            const positions = [
                -1, -1,
                -1, 1,
                1, -1,
                1, 1,
            ];
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
            
            // Create texture coordinate buffer
            this.texCoordBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
            
            // Texture coordinates for the rectangle
            const texCoords = [
                0, 1,
                0, 0,
                1, 1,
                1, 0,
            ];
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
            
            // Create video texture
            this.videoTexture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            
            // Create background texture
            this.backgroundTexture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.backgroundTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            
            this.isInitialized = true;
            this.debugCallback('WebGL model initialized successfully');
            return true;
        } catch (error) {
            this.debugCallback('Failed to initialize WebGL model: ' + error.message);
            throw error;
        }
    }

    // Create a WebGL shader
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        // Check if shader compiled successfully
        const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
        if (!success) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('Could not compile shader: ' + error);
        }
        
        return shader;
    }

    // Create a WebGL program linking shaders
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        // Check if program linked successfully
        const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
        if (!success) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error('Could not link program: ' + error);
        }
        
        return program;
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
            // Resize WebGL canvas to match video dimensions
            this.gl.canvas.width = canvasElement.width;
            this.gl.canvas.height = canvasElement.height;
            
            // Tell WebGL how to convert from clip space to pixels
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
            
            // Clear the canvas
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            
            // Use our shader program
            this.gl.useProgram(this.program);
            
            // Set up position attribute
            this.gl.enableVertexAttribArray(
                this.gl.getAttribLocation(this.program, 'a_position'));
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            this.gl.vertexAttribPointer(
                this.gl.getAttribLocation(this.program, 'a_position'),
                2,          // size (num values per vertex)
                this.gl.FLOAT, // type of data
                false,      // normalize
                0,          // stride (0 = auto)
                0,          // offset
            );
            
            // Set up texture coordinate attribute
            this.gl.enableVertexAttribArray(
                this.gl.getAttribLocation(this.program, 'a_texCoord'));
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
            this.gl.vertexAttribPointer(
                this.gl.getAttribLocation(this.program, 'a_texCoord'),
                2,          // size (num values per vertex)
                this.gl.FLOAT, // type of data
                false,      // normalize
                0,          // stride (0 = auto)
                0,          // offset
            );
            
            // Update the video texture
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
            this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,                // level
                this.gl.RGBA,     // internal format
                this.gl.RGBA,     // format
                this.gl.UNSIGNED_BYTE, // type
                videoElement      // data source
            );
            
            // Set video texture uniform
            this.gl.uniform1i(
                this.gl.getUniformLocation(this.program, 'u_video'),
                0  // texture unit 0
            );
            
            // Update background texture based on background type
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.backgroundTexture);
            
            // Handle different background types
            let backgroundSource;
            
            if (backgroundType === 'blur') {
                // Create a blurred version of the video frame
                const blurCanvas = document.createElement('canvas');
                blurCanvas.width = videoElement.videoWidth;
                blurCanvas.height = videoElement.videoHeight;
                const blurCtx = blurCanvas.getContext('2d');
                
                // Apply a blur effect
                blurCtx.filter = 'blur(15px)';
                blurCtx.drawImage(videoElement, 0, 0, blurCanvas.width, blurCanvas.height);
                blurCtx.filter = 'none';
                
                backgroundSource = blurCanvas;
                
            } else if ((backgroundType === 'beach' || backgroundType === 'custom') && 
                      backgroundImage && backgroundImage.complete) {
                backgroundSource = backgroundImage;
            } else {
                // Default: just use a color
                const colorCanvas = document.createElement('canvas');
                colorCanvas.width = 1;
                colorCanvas.height = 1;
                const colorCtx = colorCanvas.getContext('2d');
                colorCtx.fillStyle = '#000000';
                colorCtx.fillRect(0, 0, 1, 1);
                backgroundSource = colorCanvas;
            }
            
            // Update the background texture
            this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,                // level
                this.gl.RGBA,     // internal format
                this.gl.RGBA,     // format
                this.gl.UNSIGNED_BYTE, // type
                backgroundSource  // data source
            );
            
            // Set background texture uniform
            this.gl.uniform1i(
                this.gl.getUniformLocation(this.program, 'u_background'),
                1  // texture unit 1
            );
            
            // Set color threshold uniform (for green screen effect)
            // Format: [redThreshold, blueThreshold, absoluteThreshold, smoothingFactor]
            const colorThreshold = [1.4, 1.4, 0.2, 0.08];
            this.gl.uniform4fv(
                this.gl.getUniformLocation(this.program, 'u_colorThreshold'),
                colorThreshold
            );
            
            // Draw the rectangle (2 triangles)
            this.gl.drawArrays(
                this.gl.TRIANGLE_STRIP, // primitive type
                0,                     // offset
                4                      // count
            );
            
            // Copy the WebGL canvas to the destination canvas
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(this.gl.canvas, 0, 0, canvasElement.width, canvasElement.height);
            
            const segmentationTime = performance.now() - startTime;
            this.debugCallback(`WebGL model processed frame with ${backgroundType} background`);
            
            const totalTime = performance.now() - startTime;
            return {
                segmentationTime: segmentationTime,
                totalTime: totalTime
            };
            
        } catch (error) {
            this.debugCallback('Error in WebGL processing: ' + error.message);
            // Fallback to original frame
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
            this.gl.deleteProgram(this.program);
            this.gl.deleteShader(this.vertexShader);
            this.gl.deleteShader(this.fragmentShader);
            this.gl.deleteBuffer(this.positionBuffer);
            this.gl.deleteBuffer(this.texCoordBuffer);
            this.gl.deleteTexture(this.videoTexture);
            this.gl.deleteTexture(this.backgroundTexture);
            
            this.isInitialized = false;
            this.debugCallback('WebGL model resources disposed');
        }
    }
}

export default WebGLModel;