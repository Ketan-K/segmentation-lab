// Virtual background service for handling background effects
import { showAlert } from '../utils/alertUtils.js';
import { updateDebugInfo } from '../utils/generalUtils.js';

/**
 * Initializes and manages virtual background functionality
 * @param {Object} uiElements - UI elements references
 * @returns {Object} - Background service methods
 */
export function initVirtualBackground(uiElements) {
    // Virtual background configuration
    const virtualBackground = {
        enabled: false,
        type: 'none',
        model: 'mediaPipe', // Default model
        image: null,
        activeModel: null, // Will hold the current active model instance
        stream: null,
        context: null,
        animationFrame: null,
        targetFps: 30,
        lastProcessedVideoTime: -1,
        videoTrack: null,
        canvasStream: null,
        backgroundImages: {
            beach: null,
            office: null,
            custom: null
        },
        // Model metrics storage for comparison
        modelMetrics: {
            mediaPipe: { fps: 0, segTime: 0, processTime: 0 },
            bodypix: { fps: 0, segTime: 0, processTime: 0 }
        }
    };

    /**
     * Sets the canvas context for the virtual background
     * @param {CanvasRenderingContext2D} context - The 2D canvas context
     */
    function setContext(context) {
        virtualBackground.context = context;
        // Load background images after context is set
        loadBackgroundImages();
    }

    /**
     * Load background images
     */
    function loadBackgroundImages() {
        // Beach background
        virtualBackground.backgroundImages.beach = new Image();
        virtualBackground.backgroundImages.beach.onload = () => updateDebugInfo('Beach background loaded successfully');
        virtualBackground.backgroundImages.beach.onerror = (e) => updateDebugInfo('Error loading beach background: ' + e.message);
        virtualBackground.backgroundImages.beach.src = 'assets/beach.png';
        
        // Office background
        virtualBackground.backgroundImages.office = new Image();
        virtualBackground.backgroundImages.office.onload = () => updateDebugInfo('Office background loaded successfully');
        virtualBackground.backgroundImages.office.onerror = (e) => updateDebugInfo('Error loading office background: ' + e.message);
        virtualBackground.backgroundImages.office.src = 'assets/office.png';
        
        // Preload background images as a separate operation
        setTimeout(() => {
            // Force preload by accessing properties (this can trigger actual loading)
            const beachCheck = virtualBackground.backgroundImages.beach.width;
            const officeCheck = virtualBackground.backgroundImages.office.width;
            updateDebugInfo(`Preload check - Beach: ${beachCheck}px, Office: ${officeCheck}px`);
        }, 2000);
    }

    /**
     * Set virtual background type
     * @param {string} type - Background type ('none', 'beach', 'office', 'custom')
     */
    function setVirtualBackgroundType(type) {
        virtualBackground.type = type;
        updateDebugInfo('Background type set to: ' + type);
        
        // Update UI - new UI uses bg-option class instead of background-option
        const options = document.querySelectorAll('.bg-option');
        options.forEach(option => {
            if (option.dataset.bg === type) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    /**
     * Load selected background model
     * @param {string} modelType - Optional model type to load
     * @returns {Promise<boolean>} - Whether model was loaded successfully
     */
    async function loadSelectedModel(modelType = null) {
        // If a model type is provided, use it
        if (modelType) {
            virtualBackground.model = modelType;
        }
        
        // Clean up existing model if any
        if (virtualBackground.activeModel) {
            try {
                virtualBackground.activeModel.dispose();
            } catch (e) {
                updateDebugInfo(`Error disposing current model: ${e.message}`);
            }
        }
        
        try {
            // Get the model factory from the window (set in app.js)
            const modelFactory = window.modelFactory;
            
            if (!modelFactory) {
                throw new Error('Model factory not initialized');
            }
            
            // Create a new model instance using the factory
            virtualBackground.activeModel = await modelFactory.createModel(virtualBackground.model);
            
            if (!virtualBackground.activeModel) {
                throw new Error(`Failed to create model of type: ${virtualBackground.model}`);
            }
            
            // Update UI
            uiElements.currentModelEl.textContent = virtualBackground.model;
            
            // Initialize the model
            const success = await virtualBackground.activeModel.init();
            if (success) {
                showAlert(`${virtualBackground.model} model initialized successfully`, 'success');
            }
            return success;
        } catch (error) {
            updateDebugInfo(`Error initializing model: ${error.message}`);
            showAlert(`Could not initialize ${virtualBackground.model} model.`, 'error');
            return false;
        }
    }

    /**
     * Reload the background model using settings from model factory
     * @returns {Promise<boolean>}
     */
    async function reloadBackgroundModel() {
        // Store the current background state
        const wasEnabled = virtualBackground.enabled;
        
        // If enabled, toggle it off first
        if (wasEnabled) {
            await toggle(false); // Pass false to explicitly turn it off
        }
        
        // Get current model type
        const currentModelType = virtualBackground.model;
        
        // Get new model from factory using auto selection
        const modelFactory = window.modelFactory;
        if (!modelFactory) {
            updateDebugInfo('Model factory not available');
            return false;
        }
        
        try {
            // If user has a preferred model, that will be used by the factory
            const newModel = await modelFactory.createModel();
            virtualBackground.model = modelFactory.userPreferredModel || 
                                     (await modelFactory.getDeviceCapabilities()).recommendedModel || 
                                     'mediaPipe';
            
            // Clean up old model if present
            if (virtualBackground.activeModel) {
                try {
                    virtualBackground.activeModel.dispose();
                } catch (e) {
                    updateDebugInfo(`Error disposing current model: ${e.message}`);
                }
            }
            
            // Save metrics from previous model if different
            if (currentModelType.toLowerCase() !== virtualBackground.model.toLowerCase()) {
                resetAndSaveMetrics(currentModelType);
            }
            
            // Set the new model
            virtualBackground.activeModel = newModel;
            
            // Update UI
            uiElements.currentModelEl.textContent = virtualBackground.model;
            
            // Initialize the model
            const success = await virtualBackground.activeModel.init();
            
            if (success) {
                showAlert(`${virtualBackground.model} model loaded successfully`, 'success');
            } else {
                throw new Error(`Failed to initialize ${virtualBackground.model} model`);
            }
            
            // If it was previously enabled, turn it back on
            if (wasEnabled && success) {
                await toggle(true); // Pass true to explicitly turn it on
            }
            
            return success;
        } catch (error) {
            updateDebugInfo(`Error reloading model: ${error.message}`);
            showAlert(`Could not reload model: ${error.message}`, 'error');
            
            // Restore original model
            virtualBackground.model = currentModelType;
            
            // Try to reactivate previous model
            if (wasEnabled) {
                await toggle(true);
            }
            
            return false;
        }
    }

    /**
     * Apply virtual background using active model
     */
    async function applyVirtualBackground() {
        if (!virtualBackground.enabled || !virtualBackground.activeModel) return;
        
        try {
            // Get background image based on selected type
            let backgroundImage = null;
            if (virtualBackground.type === 'custom' && virtualBackground.image) {
                backgroundImage = virtualBackground.image;
            } else if (virtualBackground.type === 'beach') {
                backgroundImage = virtualBackground.backgroundImages.beach;
            } else if (virtualBackground.type === 'office') {
                backgroundImage = virtualBackground.backgroundImages.office;
            }
            
            // Debug background image loading issues
            if (virtualBackground.type === 'office' && (!backgroundImage || !backgroundImage.complete)) {
                updateDebugInfo(`Office background image issue: loaded=${backgroundImage ? 'yes' : 'no'}, complete=${backgroundImage ? backgroundImage.complete : 'n/a'}`);
                // Try to reload the office background
                if (!virtualBackground.backgroundImages.office || !virtualBackground.backgroundImages.office.complete) {
                    updateDebugInfo('Reloading office background image');
                    virtualBackground.backgroundImages.office = new Image();
                    virtualBackground.backgroundImages.office.onload = () => updateDebugInfo('Office background reloaded successfully');
                    virtualBackground.backgroundImages.office.onerror = (e) => updateDebugInfo('Error reloading office background: ' + e.message);
                    virtualBackground.backgroundImages.office.src = 'assets/office.png';
                    
                    // For this frame, use beach as fallback if available
                    if (virtualBackground.backgroundImages.beach && virtualBackground.backgroundImages.beach.complete) {
                        backgroundImage = virtualBackground.backgroundImages.beach;
                    }
                }
            }
            
            // Process frame using active model
            const result = await virtualBackground.activeModel.processFrame(
                uiElements.localVideo, 
                uiElements.localCanvas, 
                virtualBackground.type, 
                backgroundImage
            );
            
            // Update performance metrics
            if (result) {
                updatePerformanceMetrics(result.segmentationTime, result.totalTime);
            }
            
            // Create a frame from the processed canvas and send it to the stream
            if (virtualBackground.videoTrack && virtualBackground.videoTrack.requestFrame) {
                virtualBackground.videoTrack.requestFrame();
            }
        } catch (error) {
            updateDebugInfo(`Error processing frame: ${error.message}`);
            // Fallback to original video
            virtualBackground.context.drawImage(uiElements.localVideo, 0, 0, uiElements.localCanvas.width, uiElements.localCanvas.height);
            // Still request a frame even on error
            if (virtualBackground.videoTrack && virtualBackground.videoTrack.requestFrame) {
                virtualBackground.videoTrack.requestFrame();
            }
        }
    }

    // Process video frames with rate limiting
    function processVideoFrames() {
        if (!virtualBackground.enabled || !uiElements.localVideo) {
            if (virtualBackground.animationFrame) {
                cancelAnimationFrame(virtualBackground.animationFrame);
                virtualBackground.animationFrame = null;
            }
            return;
        }
        
        // Get current video timestamp - we'll use this to detect new frames
        const currentVideoTime = uiElements.localVideo.currentTime;
        
        // If the video time hasn't changed since the last processing, skip this frame
        if (virtualBackground.lastProcessedVideoTime === currentVideoTime) {
            // Schedule next check without processing (polling but not processing)
            virtualBackground.animationFrame = requestAnimationFrame(processVideoFrames);
            return;
        }
        
        // Store current video time to track frame changes
        virtualBackground.lastProcessedVideoTime = currentVideoTime;
        
        // Ensure canvas size matches video dimensions if available
        if (uiElements.localVideo.videoWidth && uiElements.localVideo.videoHeight && 
            (uiElements.localCanvas.width !== uiElements.localVideo.videoWidth || uiElements.localCanvas.height !== uiElements.localVideo.videoHeight)) {
            uiElements.localCanvas.width = uiElements.localVideo.videoWidth;
            uiElements.localCanvas.height = uiElements.localVideo.videoHeight;
            updateDebugInfo(`Canvas resized to match video: ${uiElements.localCanvas.width}x${uiElements.localCanvas.height}`);
        }
        
        // Apply virtual background
        applyVirtualBackground().then(() => {
            // After successfully processing the frame, request the next one
            virtualBackground.animationFrame = requestAnimationFrame(processVideoFrames);
        }).catch(error => {
            updateDebugInfo(`Error in frame processing: ${error.message}`);
            // Even on error, continue processing the next frame
            virtualBackground.animationFrame = requestAnimationFrame(processVideoFrames);
        });
    }

    // Variables for performance tracking
    let lastFrameTime = 0;
    let frameTimes = [];
    let segmentationTimes = [];
    let totalProcessedFrames = 0;
    let totalSegmentationTime = 0;
    let totalFrameProcessingTime = 0;
    let sessionStartTime = null;
    const MAX_MEASUREMENTS = 30; // keep last 30 measurements for moving average
    let metricUpdateInterval = null; // For regular metrics updates

    /**
     * Update performance metrics
     * @param {number} segmentationTime - Time for segmentation in ms
     * @param {number} frameTime - Total frame processing time in ms
     */
    function updatePerformanceMetrics(segmentationTime, frameTime) {
        // Save measurements
        segmentationTimes.push(segmentationTime);
        if (segmentationTimes.length > MAX_MEASUREMENTS) {
            segmentationTimes.shift();
        }
        
        // Calculate FPS
        const now = performance.now();
        if (lastFrameTime) {
            const delta = now - lastFrameTime;
            frameTimes.push(delta);
            if (frameTimes.length > MAX_MEASUREMENTS) {
                frameTimes.shift();
            }
        }
        lastFrameTime = now;
        
        // Update session totals
        totalProcessedFrames++;
        totalSegmentationTime += segmentationTime;
        totalFrameProcessingTime += frameTime;
    }

    /**
     * Reset metrics
     */
    function resetMetrics() {
        frameTimes = [];
        segmentationTimes = [];
        lastFrameTime = 0;
        totalProcessedFrames = 0;
        totalSegmentationTime = 0;
        totalFrameProcessingTime = 0;
        sessionStartTime = performance.now();
    }

    /**
     * Toggle the virtual background on/off
     * @returns {Promise<void>}
     */
    async function toggle() {
        virtualBackground.enabled = !virtualBackground.enabled;
        
        if (virtualBackground.enabled) {
            // Update UI - using the new icon button
            uiElements.toggleBackgroundButton.classList.add('active');
            uiElements.toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i>';
            uiElements.toggleBackgroundButton.title = 'Disable virtual background';
            
            // Show the model selector if it exists
            uiElements.modelSelector.classList.remove('hide');
            uiElements.performanceMetrics.classList.remove('hide');
            
            // Reset metrics when enabling
            resetMetrics();
            
            // Reset frame synchronization tracking
            virtualBackground.lastProcessedVideoTime = -1;
            
            // Start metrics updates
            startMetricsUpdates();
            
            // Ensure a model is loaded
            if (!await loadSelectedModel()) {
                // If model loading fails, disable virtual background
                virtualBackground.enabled = false;
                uiElements.toggleBackgroundButton.classList.remove('active');
                uiElements.toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i>';
                uiElements.toggleBackgroundButton.title = 'Enable virtual background';
                uiElements.modelSelector.classList.add('hide');
                uiElements.performanceMetrics.classList.add('hide');
                uiElements.localCanvas.style.display = 'none';
                return;
            }
            
            // Create a dynamic canvas stream
            const canvasStream = uiElements.localCanvas.captureStream(0); // 0 means no automatic capture
            virtualBackground.canvasStream = canvasStream;
            
            // Store video track for later use
            virtualBackground.videoTrack = canvasStream.getVideoTracks()[0];
            
            // Get the browser's actual frame rate capability
            const videoTrack = uiElements.localVideo.srcObject.getVideoTracks()[0];
            const settings = videoTrack ? videoTrack.getSettings() : null;
            virtualBackground.targetFps = settings && settings.frameRate ? Math.round(settings.frameRate) : 30;
            updateDebugInfo(`Source video FPS capability: ${virtualBackground.targetFps}`);
            
            // Add the audio tracks from the original stream
            const audioTracks = uiElements.localVideo.srcObject.getAudioTracks();
            audioTracks.forEach(track => {
                canvasStream.addTrack(track);
            });
            
            // Save original stream
            virtualBackground.stream = uiElements.localVideo.srcObject;
            
            // Position canvas properly
            uiElements.localCanvas.style.display = 'block';
            uiElements.localCanvas.style.position = 'absolute';
            uiElements.localCanvas.style.top = '0';
            uiElements.localCanvas.style.left = '0';
            uiElements.localCanvas.style.width = '100%';
            uiElements.localCanvas.style.height = '100%';
            uiElements.localCanvas.style.zIndex = '1'; // Place above video
            
            // Hide the video element but keep it for processing
            uiElements.localVideo.style.opacity = '0';
            
            // If already in a WebRTC connection, replace the existing track
            if (window.peerConnection) {
                const senders = window.peerConnection.getSenders();
                const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                if (videoSender) {
                    videoSender.replaceTrack(canvasStream.getVideoTracks()[0]);
                }
            }
            
            // Make sure the canvas is in the same container as the video
            const videoWrapper = uiElements.localVideo.closest('.video-wrapper');
            if (videoWrapper && !videoWrapper.contains(uiElements.localCanvas)) {
                videoWrapper.appendChild(uiElements.localCanvas);
            }
            
            // Start processing frames
            processVideoFrames();
            
            updateDebugInfo('Virtual background enabled: ' + virtualBackground.model);
        } else {
            // Update UI - using the new icon button
            uiElements.toggleBackgroundButton.classList.remove('active');
            uiElements.toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i>';
            uiElements.toggleBackgroundButton.title = 'Enable virtual background';
            uiElements.modelSelector.classList.add('hide');
            uiElements.performanceMetrics.classList.add('hide');
            
            // Stop metrics updates
            stopMetricsUpdates();
            
            // Hide canvas
            uiElements.localCanvas.style.display = 'none';
            
            // Restore original video visibility
            uiElements.localVideo.style.opacity = '1';
            
            // Restore original stream
            if (virtualBackground.stream) {
                // If already in a WebRTC connection, replace the track
                if (window.peerConnection) {
                    const senders = window.peerConnection.getSenders();
                    const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                    const originalVideoTrack = virtualBackground.stream.getVideoTracks()[0];
                    if (videoSender && originalVideoTrack) {
                        videoSender.replaceTrack(originalVideoTrack);
                    }
                }
                
                // Restore local video
                uiElements.localVideo.srcObject = virtualBackground.stream;
                uiElements.localVideo.style.backgroundColor = '#222';
            }
            
            // Stop processing frames
            if (virtualBackground.animationFrame) {
                cancelAnimationFrame(virtualBackground.animationFrame);
                virtualBackground.animationFrame = null;
            }
            
            updateDebugInfo('Virtual background disabled');
        }
    }

    /**
     * Start metrics updates
     */
    function startMetricsUpdates() {
        if (metricUpdateInterval) {
            clearInterval(metricUpdateInterval);
        }
        
        // Update metrics display once per second
        metricUpdateInterval = setInterval(() => {
            updateMetricsDisplay();
        }, 1000);
    }

    /**
     * Stop metrics updates
     */
    function stopMetricsUpdates() {
        if (metricUpdateInterval) {
            clearInterval(metricUpdateInterval);
            metricUpdateInterval = null;
        }
    }

    /**
     * Update metrics display with latest average data
     */
    function updateMetricsDisplay() {
        // Calculate averages
        const avgSegmentationTime = segmentationTimes.length > 0 ? 
            segmentationTimes.reduce((a, b) => a + b, 0) / segmentationTimes.length : 0;
        
        const avgFrameTime = frameTimes.length > 0 ? 
            frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0;
        
        // Calculate FPS based on the video's actual frame rate capability
        // instead of raw processing speed to ensure UI display matches reality
        const fps = virtualBackground.targetFps 
            ? Math.min(virtualBackground.targetFps, avgFrameTime ? 1000 / avgFrameTime : 0)
            : (avgFrameTime ? 1000 / avgFrameTime : 0);
        
        // Calculate session duration
        const sessionDuration = sessionStartTime ? 
            (performance.now() - sessionStartTime) / 1000 : 0; // in seconds
        
        // Calculate session averages
        const avgFps = sessionDuration > 0 ? Math.min(virtualBackground.targetFps || Infinity, totalProcessedFrames / sessionDuration) : 0;
        const avgSegTime = totalProcessedFrames > 0 ? totalSegmentationTime / totalProcessedFrames : 0;
        const avgFrameProcessTime = totalProcessedFrames > 0 ? totalFrameProcessingTime / totalProcessedFrames : 0;
        
        // Update UI with the averages
        uiElements.segmentationTimeEl.textContent = avgSegmentationTime.toFixed(2);
        uiElements.frameProcessingTimeEl.textContent = avgFrameProcessTime.toFixed(2);
        uiElements.fpsEl.textContent = fps.toFixed(1);
        uiElements.currentModelEl.textContent = virtualBackground.model;
        
        // Update session metrics
        document.getElementById('sessionDuration').textContent = formatTime(sessionDuration);
        document.getElementById('framesProcessed').textContent = totalProcessedFrames.toString();
        
        // Update overlay metrics
        const currentModelOverlay = document.getElementById('currentModelOverlay');
        const fpsOverlay = document.getElementById('fpsOverlay');
        const segmentationTimeOverlay = document.getElementById('segmentationTimeOverlay');
        const frameProcessingTimeOverlay = document.getElementById('frameProcessingTimeOverlay');
        
        if (currentModelOverlay) currentModelOverlay.textContent = virtualBackground.model;
        if (fpsOverlay) fpsOverlay.textContent = fps.toFixed(1);
        if (segmentationTimeOverlay) segmentationTimeOverlay.textContent = `${avgSegmentationTime.toFixed(2)}ms`;
        if (frameProcessingTimeOverlay) frameProcessingTimeOverlay.textContent = `${avgFrameProcessTime.toFixed(2)}ms`;
    }

    /**
     * Format time in seconds to MM:SS format
     */
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Upload custom background image
     */
    function uploadCustomBackground() {
        uiElements.customBackgroundInput.click();
    }

    /**
     * Handle custom background file selection
     */
    function handleCustomBackgroundSelected() {
        const file = uiElements.customBackgroundInput.files[0];
        if (!file) return;
        
        // Validate file is an image and not too large
        if (!file.type.startsWith('image/')) {
            showAlert('Please select an image file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showAlert('Image is too large. Please select an image under 5MB', 'error');
            return;
        }
        
        updateDebugInfo('Loading custom background image...');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            virtualBackground.image = new Image();
            virtualBackground.image.onload = () => {
                // Create or show the custom background option
                createOrShowCustomBackgroundOption();
                
                virtualBackground.type = 'custom';
                setVirtualBackgroundType('custom');
                updateDebugInfo('Custom background loaded successfully');
                showCustomBackgroundPreview(virtualBackground.image);
                showAlert('Custom background loaded successfully', 'success');
            };
            virtualBackground.image.onerror = () => {
                updateDebugInfo('Error loading custom background image');
                showAlert('Error loading image. Please try another image.', 'error');
            };
            virtualBackground.image.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Create or show the custom background option
     */
    function createOrShowCustomBackgroundOption() {
        let customOption = document.querySelector('.background-option[data-bg="custom"]');
        
        // If the custom option doesn't exist, create it
        if (!customOption) {
            customOption = document.createElement('div');
            customOption.className = 'background-option';
            customOption.dataset.bg = 'custom';
            
            const customImg = document.createElement('img');
            customImg.alt = 'Custom';
            customImg.src = virtualBackground.image.src;
            customOption.appendChild(customImg);
            
            // Insert the custom option before the upload button
            const uploadButton = document.getElementById('uploadBackground');
            uiElements.backgroundSelector.insertBefore(customOption, uploadButton);
            
            // Add event listener to the new option
            customOption.addEventListener('click', () => {
                if (!virtualBackground.enabled) {
                    toggle(); // Turn on virtual background
                }
                setVirtualBackgroundType('custom');
            });
        } else {
            // If it exists, just update the image
            const customImg = customOption.querySelector('img');
            if (customImg) {
                customImg.src = virtualBackground.image.src;
            }
            customOption.style.display = 'block';
        }
    }

    /**
     * Update custom background preview
     * @param {HTMLImageElement} image - The image to preview
     */
    function showCustomBackgroundPreview(image) {
        const previewContainer = document.getElementById('customBackgroundPreview');
        const previewImage = document.getElementById('customBackgroundImage');
        
        if (image) {
            previewImage.src = image.src;
            previewContainer.classList.remove('hide');
        } else {
            previewContainer.classList.add('hide');
        }
    }

    /**
     * Reset and save metrics for the current model before switching
     * @param {string} oldModel - The name of the previous model
     */
    function resetAndSaveMetrics(oldModel) {
        if (oldModel && virtualBackground.model !== oldModel) {
            // Store current metrics for the old model before resetting
            const fps = document.getElementById('fps').textContent;
            const segTime = document.getElementById('segmentationTime').textContent;
            const processTime = document.getElementById('frameProcessingTime').textContent;
            
            virtualBackground.modelMetrics[oldModel] = {
                fps: parseFloat(fps) || 0,
                segTime: parseFloat(segTime) || 0,
                processTime: parseFloat(processTime) || 0
            };
            
            // Reset metrics for new model
            resetMetrics();
            
            // Update the UI with comparison metrics
            updateComparisonMetrics();
            
            // Show a comparison alert to the user
            showMetricsComparisonAlert(oldModel, virtualBackground.model);
        }
    }

    /**
     * Show metrics comparison alert
     * @param {string} oldModel - The previous model
     * @param {string} newModel - The new model
     */
    function showMetricsComparisonAlert(oldModel, newModel) {
        const oldMetrics = virtualBackground.modelMetrics[oldModel];
        
        if (oldMetrics && oldMetrics.fps > 0) {
            const message = `
                <div class="comparison-alert">
                    <p><strong>${oldModel}</strong> performance:</p>
                    <ul>
                        <li>FPS: ${oldMetrics.fps.toFixed(1)}</li>
                        <li>Segmentation time: ${oldMetrics.segTime.toFixed(2)} ms</li>
                        <li>Processing time: ${oldMetrics.processTime.toFixed(2)} ms</li>
                    </ul>
                    <p>Now testing <strong>${newModel}</strong>...</p>
                </div>
            `;
            
            showAlert(message, 'info', 'Model Comparison', 8000);
        }
    }

    /**
     * Update the UI with comparison metrics between models
     */
    function updateComparisonMetrics() {
        const comparisonSection = document.getElementById('modelComparisonSection');
        if (!comparisonSection) {
            // Create the comparison section if it doesn't exist
            createComparisonSection();
            return;
        }
        
        const comparisonBody = document.getElementById('modelComparisonBody');
        if (comparisonBody) {
            comparisonBody.innerHTML = ''; // Clear existing rows
            
            // Add a row for each model with data
            for (const [model, metrics] of Object.entries(virtualBackground.modelMetrics)) {
                if (metrics.fps > 0 || metrics.segTime > 0 || metrics.processTime > 0) {
                    const row = document.createElement('tr');
                    
                    // Create model name cell
                    const modelCell = document.createElement('td');
                    modelCell.textContent = model;
                    row.appendChild(modelCell);
                    
                    // Create FPS cell
                    const fpsCell = document.createElement('td');
                    fpsCell.textContent = metrics.fps.toFixed(1);
                    row.appendChild(fpsCell);
                    
                    // Create segmentation time cell
                    const segTimeCell = document.createElement('td');
                    segTimeCell.textContent = metrics.segTime.toFixed(2);
                    row.appendChild(segTimeCell);
                    
                    // Create processing time cell
                    const processTimeCell = document.createElement('td');
                    processTimeCell.textContent = metrics.processTime.toFixed(2);
                    row.appendChild(processTimeCell);
                    
                    // Add highlight for current model
                    if (model === virtualBackground.model) {
                        row.classList.add('current-model');
                    }
                    
                    comparisonBody.appendChild(row);
                }
            }
        }
    }

    /**
     * Create comparison metrics section if needed
     */
    function createComparisonSection() {
        const metricsContainer = document.getElementById('performanceMetrics');
        if (!metricsContainer) return;
        
        // Get the comparison section that already exists in the HTML
        const comparisonSection = document.getElementById('modelComparisonSection');
        if (!comparisonSection) return;
        
        // Check if there's any model data to compare
        let hasData = false;
        for (const metrics of Object.values(virtualBackground.modelMetrics)) {
            if (metrics.fps > 0 || metrics.segTime > 0 || metrics.processTime > 0) {
                hasData = true;
                break;
            }
        }
        
        // Show/hide the section based on data availability
        if (hasData) {
            comparisonSection.classList.remove('hide');
            updateComparisonMetrics();
        } else {
            comparisonSection.classList.add('hide');
        }
    }

    // Register event listeners
    uiElements.toggleBackgroundButton.addEventListener('click', toggle);
    uiElements.uploadBackgroundButton.addEventListener('click', uploadCustomBackground);
    uiElements.customBackgroundInput.addEventListener('change', handleCustomBackgroundSelected);
    
    // Removed the backgroundModelSelect event listener since we only have MediaPipe now

    // Background option selection
    document.querySelectorAll('.background-option').forEach(option => {
        option.addEventListener('click', () => {
            const bgType = option.dataset.bg;
            if (bgType === 'none') {
                toggle(); // Turn off virtual background
            } else {
                if (!virtualBackground.enabled) {
                    toggle(); // Turn on virtual background
                }
                setVirtualBackgroundType(bgType);
            }
        });
    });

    // Return public methods
    return {
        toggle,
        setType: setVirtualBackgroundType,
        loadModel: loadSelectedModel,
        uploadCustomBackground,
        isEnabled: () => virtualBackground.enabled,
        getCurrentModel: () => virtualBackground.model,
        setContext,
        resetMetrics,
        reloadBackgroundModel, // Add the new function to public API
        
        // Performance metrics for ModelLabUI
        getPerformanceMetrics: () => {
            // Calculate current fps from frame times
            const fps = frameTimes.length > 0 ? 
                1000 / (frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length) : 0;
                
            // Calculate average segmentation time
            const segmentationTime = segmentationTimes.length > 0 ? 
                segmentationTimes.reduce((a, b) => a + b, 0) / segmentationTimes.length : 0;
                
            // Calculate total processing time based on last few frames
            const totalProcessingTime = frameTimes.length > 0 ? 
                frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0;
                
            return {
                fps,
                segmentationTime,
                totalProcessingTime,
                totalFrames: totalProcessedFrames
            };
        },
        
        // All other existing functions
        applyVirtualBackground,
        processVideoFrames,
        updatePerformanceMetrics,
        startMetricsUpdates,
        stopMetricsUpdates,
        updateMetricsDisplay,
        resetAndSaveMetrics,
        showMetricsComparisonAlert,
        updateComparisonMetrics,
        createComparisonSection,
        handleCustomBackgroundSelected,
        createOrShowCustomBackgroundOption,
        showCustomBackgroundPreview
    };
}