// Import model implementations
import BodyPixModel from './models/BodyPixModel.js';
import MediaPipeModel from './models/MediaPipeModel.js';
import WebGLModel from './models/WebGLModel.js';
import SAM2Model from './models/SAM2Model.js';

// Connect to the signaling server
const socket = io();

// Get DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleAudioButton = document.getElementById('toggleAudio');
const toggleVideoButton = document.getElementById('toggleVideo');
const endCallButton = document.getElementById('endCall');
const createMeetingButton = document.getElementById('createMeeting');
const joinMeetingButton = document.getElementById('joinMeeting');
const meetingCodeInput = document.getElementById('meetingCodeInput');
const meetingCodeDisplay = document.getElementById('meetingCodeDisplay');
const copyMeetingCodeButton = document.getElementById('copyMeetingCode');
const setupPanel = document.getElementById('setup-panel');
const callPanel = document.getElementById('call-panel');
const toggleBackgroundButton = document.getElementById('toggleBackground');
const backgroundSelector = document.getElementById('backgroundSelector');
const uploadBackgroundButton = document.getElementById('uploadBackground');
const customBackgroundInput = document.getElementById('customBackground');
const localCanvas = document.getElementById('localCanvas');
const backgroundModelSelect = document.getElementById('backgroundModel');
const modelSelector = document.getElementById('modelSelector');
const performanceMetrics = document.getElementById('performanceMetrics');
const debugInfoElement = document.getElementById('debugInfo');

// Performance metrics elements
const segmentationTimeEl = document.getElementById('segmentationTime');
const frameProcessingTimeEl = document.getElementById('frameProcessingTime');
const fpsEl = document.getElementById('fps');
const currentModelEl = document.getElementById('currentModel');

// WebRTC variables
let localStream;
let peerConnection;
let meetingCode = '';
let isInitiator = false;

// Performance metrics
let lastFrameTime = 0;
let frameTimes = [];
let segmentationTimes = [];
let totalProcessedFrames = 0;
let totalSegmentationTime = 0;
let totalFrameProcessingTime = 0;
let sessionStartTime = null;
const MAX_MEASUREMENTS = 30; // keep last 30 measurements for moving average
let metricUpdateInterval = null; // For regular metrics updates

// Debug function
function updateDebugInfo(message) {
    if (debugInfoElement) {
        debugInfoElement.textContent = message;
        console.log(message);
    }
}

// Virtual background configuration
let virtualBackground = {
    enabled: false,
    type: 'none',
    model: 'mediaPipe', // Changed default from bodyPix to mediaPipe
    image: null,
    activeModel: null, // Will hold the current active model instance
    stream: null,
    context: null,
    animationFrame: null,
    backgroundImages: {
        beach: null,
        office: null,
        custom: null
    },
    // Model metrics storage for comparison
    modelMetrics: {
        bodyPix: { fps: 0, segTime: 0, processTime: 0 },
        mediaPipe: { fps: 0, segTime: 0, processTime: 0 },
        webgl: { fps: 0, segTime: 0, processTime: 0 },
        sam2: { fps: 0, segTime: 0, processTime: 0 }
    }
};

// STUN/TURN servers configuration
const configuration = { 
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ] 
};

// In-app alert system
function showAlert(message, type = 'info', title = '', duration = 5000) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `app-alert ${type}`;
    alert.id = alertId;
    
    // Set icon based on type
    let icon = 'info-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'success') icon = 'check-circle';
    
    // Set title if not provided
    if (!title) {
        if (type === 'error') title = 'Error';
        if (type === 'success') title = 'Success';
        if (type === 'info') title = 'Information';
    }
    
    // Build alert content
    alert.innerHTML = `
        <div class="alert-icon"><i class="fas fa-${icon}"></i></div>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
        </div>
        <button class="close-alert"><i class="fas fa-times"></i></button>
    `;
    
    // Add event listener to close button
    alertContainer.appendChild(alert);
    
    // Show alert with animation
    setTimeout(() => alert.classList.add('show'), 10);
    
    // Set up auto-dismiss
    const timeoutId = setTimeout(() => dismissAlert(alertId), duration);
    
    // Add click event to close button
    alert.querySelector('.close-alert').addEventListener('click', () => {
        clearTimeout(timeoutId);
        dismissAlert(alertId);
    });
    
    return alertId;
}

function dismissAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (!alert) return;
    
    alert.classList.remove('show');
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 300);
}

// Generate a random meeting code
function generateMeetingCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Update performance metrics
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
    
    // Don't update UI on every frame to avoid flickering
    // UI updates are handled by updateMetricsDisplay() on a timer
}

// Update metrics display at a fixed interval
function startMetricsUpdates() {
    if (metricUpdateInterval) {
        clearInterval(metricUpdateInterval);
    }
    
    // Update metrics display once per second
    metricUpdateInterval = setInterval(() => {
        updateMetricsDisplay();
    }, 1000);
}

// Stop metrics updates
function stopMetricsUpdates() {
    if (metricUpdateInterval) {
        clearInterval(metricUpdateInterval);
        metricUpdateInterval = null;
    }
}

// Update metrics display with latest average data
function updateMetricsDisplay() {
    // Calculate averages
    const avgSegmentationTime = segmentationTimes.length > 0 ? 
        segmentationTimes.reduce((a, b) => a + b, 0) / segmentationTimes.length : 0;
    
    const avgFrameTime = frameTimes.length > 0 ? 
        frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0;
    
    const fps = avgFrameTime ? 1000 / avgFrameTime : 0;
    
    // Calculate session duration
    const sessionDuration = sessionStartTime ? 
        (performance.now() - sessionStartTime) / 1000 : 0; // in seconds
    
    // Calculate session averages
    const avgFps = sessionDuration > 0 ? totalProcessedFrames / sessionDuration : 0;
    const avgSegTime = totalProcessedFrames > 0 ? totalSegmentationTime / totalProcessedFrames : 0;
    const avgFrameProcessTime = totalProcessedFrames > 0 ? totalFrameProcessingTime / totalProcessedFrames : 0;
    
    // Update UI with the averages
    segmentationTimeEl.textContent = avgSegmentationTime.toFixed(2);
    frameProcessingTimeEl.textContent = avgFrameProcessTime.toFixed(2);
    fpsEl.textContent = fps.toFixed(1);
    currentModelEl.textContent = virtualBackground.model;
    
    // Update session metrics
    document.getElementById('sessionDuration').textContent = formatTime(sessionDuration);
    document.getElementById('framesProcessed').textContent = totalProcessedFrames.toString();
}

// Format time in seconds to MM:SS format
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Load background images
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

// Initialize media
async function initializeMedia() {
    try {
        updateDebugInfo('Initializing media devices...');
        // Start with audio muted for better user experience
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true
        });
        
        // Immediately mute audio
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].enabled = false;
            toggleAudioButton.innerHTML = '<i class="fas fa-microphone-slash"></i> Unmute Audio';
            toggleAudioButton.classList.add('active');
        }
        
        localVideo.srcObject = localStream;
        
        // Initialize session metrics
        sessionStartTime = performance.now();
        totalProcessedFrames = 0;
        totalSegmentationTime = 0;
        totalFrameProcessingTime = 0;
        
        // Wait for video to be ready to get dimensions
        await new Promise(resolve => {
            if (localVideo.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                resolve();
            } else {
                localVideo.addEventListener('loadeddata', () => {
                    updateDebugInfo(`Video loaded: ${localVideo.videoWidth}x${localVideo.videoHeight}`);
                    resolve();
                }, { once: true });
                
                // Fallback in case loadeddata doesn't fire
                setTimeout(() => {
                    updateDebugInfo('Video load timeout, continuing...');
                    resolve();
                }, 3000);
            }
        });
        
        // Ensure video has valid dimensions before continuing
        if (!localVideo.videoWidth || !localVideo.videoHeight) {
            updateDebugInfo('Video dimensions not available yet, using defaults: 640x480');
            localCanvas.width = 640;
            localCanvas.height = 480;
        } else {
            localCanvas.width = localVideo.videoWidth;
            localCanvas.height = localVideo.videoHeight;
            updateDebugInfo(`Canvas initialized to ${localCanvas.width}x${localCanvas.height}`);
        }
        
        virtualBackground.context = localCanvas.getContext('2d');
        
        // Load background images
        loadBackgroundImages();
        
        // Show model selector after video is initialized
        modelSelector.classList.remove('hide');
        
        updateDebugInfo('Media devices initialized successfully. Video dimensions: ' + 
                        localCanvas.width + 'x' + localCanvas.height);
        
        return true;
    } catch (error) {
        updateDebugInfo('Error accessing media devices: ' + error.message);
        showAlert('Error accessing camera and microphone. Please make sure you have granted the necessary permissions.', 'error');
        return false;
    }
}

// Load selected background model
async function loadSelectedModel() {
    const modelType = backgroundModelSelect.value;
    virtualBackground.model = modelType;
    currentModelEl.textContent = modelType;
    
    try {
        // Create new model instance based on selected type
        switch (modelType) {
            case 'bodyPix':
                virtualBackground.activeModel = new BodyPixModel(updateDebugInfo);
                break;
            
            case 'mediaPipe':
                virtualBackground.activeModel = new MediaPipeModel(updateDebugInfo);
                break;
            
            case 'webgl':
                virtualBackground.activeModel = new WebGLModel(updateDebugInfo);
                break;
            
            case 'sam2':
                virtualBackground.activeModel = new SAM2Model(updateDebugInfo);
                break;
                
            default:
                updateDebugInfo('Unknown model type: ' + modelType);
                return false;
        }
        
        // Initialize the model
        const success = await virtualBackground.activeModel.init();
        if (success) {
            showAlert(`${modelType} model initialized successfully`, 'success');
        }
        return success;
    } catch (error) {
        updateDebugInfo(`Error initializing ${modelType} model: ${error.message}`);
        showAlert(`Could not initialize ${modelType} model. Please try another model.`, 'error');
        return false;
    }
}

// Apply virtual background using active model
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
            localVideo, 
            localCanvas, 
            virtualBackground.type, 
            backgroundImage
        );
        
        // Update performance metrics
        updatePerformanceMetrics(result.segmentationTime, result.totalTime);
    } catch (error) {
        updateDebugInfo(`Error processing frame: ${error.message}`);
        // Fallback to original video
        virtualBackground.context.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
    }
}

// Process video frames
function processVideoFrames() {
    if (!virtualBackground.enabled || !localVideo) {
        if (virtualBackground.animationFrame) {
            cancelAnimationFrame(virtualBackground.animationFrame);
            virtualBackground.animationFrame = null;
        }
        return;
    }
    
    // Ensure canvas size matches video dimensions if available
    if (localVideo.videoWidth && localVideo.videoHeight && 
        (localCanvas.width !== localVideo.videoWidth || localCanvas.height !== localVideo.videoHeight)) {
        localCanvas.width = localVideo.videoWidth;
        localCanvas.height = localVideo.videoHeight;
        updateDebugInfo(`Canvas resized to match video: ${localCanvas.width}x${localCanvas.height}`);
    }
    
    // Apply virtual background
    applyVirtualBackground();
    
    // Schedule next frame
    virtualBackground.animationFrame = requestAnimationFrame(processVideoFrames);
}

// Toggle virtual background
async function toggleVirtualBackground() {
    virtualBackground.enabled = !virtualBackground.enabled;
    
    if (virtualBackground.enabled) {
        // Update UI
        toggleBackgroundButton.textContent = 'Virtual Background: On';
        toggleBackgroundButton.classList.add('active');
        toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i> Virtual Background: On';
        backgroundSelector.classList.remove('hide');
        performanceMetrics.classList.remove('hide');
        
        // Reset metrics when enabling
        resetMetrics();
        
        // Start metrics updates
        startMetricsUpdates();
        
        // Ensure a model is loaded
        if (!await loadSelectedModel()) {
            // If model loading fails, disable virtual background
            virtualBackground.enabled = false;
            toggleBackgroundButton.textContent = 'Virtual Background: Off';
            toggleBackgroundButton.classList.remove('active');
            toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i> Virtual Background: Off';
            backgroundSelector.classList.add('hide');
            performanceMetrics.classList.add('hide');
            localCanvas.style.display = 'none';
            return;
        }
        
        // Setup canvas for both remote and local display
        const canvasStream = localCanvas.captureStream(30);
        
        // Add the audio tracks from the original stream
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
            canvasStream.addTrack(track);
        });
        
        // Save original stream and use canvas stream for WebRTC
        virtualBackground.stream = localStream;
        
        // Position canvas properly so it's visible to the local user
        localCanvas.style.display = 'block';
        localCanvas.style.position = 'absolute';
        localCanvas.style.top = '0';
        localCanvas.style.left = '0';
        localCanvas.style.width = '100%';
        localCanvas.style.height = '100%';
        localCanvas.style.zIndex = '1'; // Place above video
        
        // Hide the video element but keep it for processing
        localVideo.style.opacity = '0';
        
        // If already connected, replace the existing tracks for remote view
        if (peerConnection) {
            const senders = peerConnection.getSenders();
            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) {
                videoSender.replaceTrack(canvasStream.getVideoTracks()[0]);
            }
        }
        
        // Make sure the canvas is in the same container as the video
        const videoWrapper = localVideo.closest('.video-wrapper');
        if (videoWrapper && !videoWrapper.contains(localCanvas)) {
            videoWrapper.appendChild(localCanvas);
        }
        
        // Start processing frames
        processVideoFrames();
        
        updateDebugInfo('Virtual background enabled: ' + virtualBackground.model);
    } else {
        // Update UI
        toggleBackgroundButton.textContent = 'Virtual Background: Off';
        toggleBackgroundButton.classList.remove('active');
        toggleBackgroundButton.innerHTML = '<i class="fas fa-palette"></i> Virtual Background: Off';
        backgroundSelector.classList.add('hide');
        performanceMetrics.classList.add('hide');
        
        // Stop metrics updates
        stopMetricsUpdates();
        
        // Hide canvas
        localCanvas.style.display = 'none';
        
        // Restore original video visibility
        localVideo.style.opacity = '1';
        
        // Restore original stream
        if (virtualBackground.stream) {
            // If already connected, replace the track
            if (peerConnection) {
                const senders = peerConnection.getSenders();
                const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
                const originalVideoTrack = virtualBackground.stream.getVideoTracks()[0];
                if (videoSender && originalVideoTrack) {
                    videoSender.replaceTrack(originalVideoTrack);
                }
            }
            
            // Restore local video
            localVideo.srcObject = virtualBackground.stream;
            localVideo.style.backgroundColor = '#222';
        }
        
        // Stop processing frames
        if (virtualBackground.animationFrame) {
            cancelAnimationFrame(virtualBackground.animationFrame);
            virtualBackground.animationFrame = null;
        }
        
        updateDebugInfo('Virtual background disabled');
    }
}

// Reset metrics
function resetMetrics() {
    frameTimes = [];
    segmentationTimes = [];
    lastFrameTime = 0;
    totalProcessedFrames = 0;
    totalSegmentationTime = 0;
    totalFrameProcessingTime = 0;
    sessionStartTime = performance.now();
    
    // Update display immediately with zeros
    updateMetricsDisplay();
}

// Set virtual background type
function setVirtualBackgroundType(type) {
    virtualBackground.type = type;
    updateDebugInfo('Background type set to: ' + type);
    
    // Update UI
    const options = document.querySelectorAll('.background-option');
    options.forEach(option => {
        if (option.dataset.bg === type) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Upload custom background
function uploadCustomBackground() {
    customBackgroundInput.click();
}

// Handle custom background file selection
function handleCustomBackgroundSelected() {
    const file = customBackgroundInput.files[0];
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

// Create or show the custom background option
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
        backgroundSelector.insertBefore(customOption, uploadButton);
        
        // Add event listener to the new option
        customOption.addEventListener('click', () => {
            if (!virtualBackground.enabled) {
                toggleVirtualBackground(); // Turn on virtual background
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

// Update custom background preview functionality
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

// Create a peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                meetingCode: meetingCode,
                candidate: event.candidate
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
    };
    
    // Handle receiving remote stream
    peerConnection.ontrack = event => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            console.log('Received remote stream');
            remoteVideo.srcObject = event.streams[0];
        }
    };
}

// Create a meeting
async function createMeeting() {
    if (!await initializeMedia()) return;

    isInitiator = true;
    meetingCode = generateMeetingCode();
    meetingCodeDisplay.textContent = meetingCode;
    
    // Join the meeting room
    socket.emit('create-meeting', meetingCode);
    
    // Show the call panel
    setupPanel.classList.add('hide');
    callPanel.classList.remove('hide');
    
    showAlert(`Created new meeting with code: ${meetingCode}`, 'success', 'Meeting Created');
}

// Join a meeting
async function joinMeeting() {
    const code = meetingCodeInput.value.trim().toUpperCase();
    if (!code) {
        showAlert('Please enter a meeting code', 'error');
        return;
    }
    
    if (!await initializeMedia()) return;

    isInitiator = false;
    meetingCode = code;
    meetingCodeDisplay.textContent = meetingCode;
    
    // Join the meeting room
    socket.emit('join-meeting', meetingCode);
    
    // Show the call panel
    setupPanel.classList.add('hide');
    callPanel.classList.remove('hide');
    
    // Create peer connection
    createPeerConnection();
    
    showAlert(`Joined meeting with code: ${meetingCode}`, 'success');
}

// Start the call process
async function startCall() {
    try {
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send the offer to the other peer
        socket.emit('offer', {
            meetingCode: meetingCode,
            offer: offer
        });
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

// Handle received offer
async function handleOffer(offer) {
    try {
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send the answer to the other peer
        socket.emit('answer', {
            meetingCode: meetingCode,
            answer: answer
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle received answer
async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle received ICE candidate
async function handleIceCandidate(candidate) {
    try {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

// Toggle audio
function toggleAudio() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) return;
        
        const isEnabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = isEnabled;
        
        toggleAudioButton.innerHTML = isEnabled ? 
            '<i class="fas fa-microphone"></i> Mute Audio' : 
            '<i class="fas fa-microphone-slash"></i> Unmute Audio';
        toggleAudioButton.classList.toggle('active', !isEnabled);
    }
}

// Toggle video
function toggleVideo() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length === 0) return;
        
        const isEnabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = isEnabled;
        
        toggleVideoButton.innerHTML = isEnabled ? 
            '<i class="fas fa-video"></i> Disable Video' : 
            '<i class="fas fa-video-slash"></i> Enable Video';
        toggleVideoButton.classList.toggle('active', !isEnabled);
        
        // If video was turned off, disable virtual background
        if (!isEnabled && virtualBackground.enabled) {
            toggleVirtualBackground(); // Turn off virtual background
            showAlert('Virtual background disabled because video was turned off', 'info');
        }
    }
}

// End the call
function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    // Reset UI
    setupPanel.classList.remove('hide');
    callPanel.classList.add('hide');
    meetingCodeInput.value = '';
    
    // Disable virtual background
    if (virtualBackground.enabled) {
        toggleVirtualBackground();
    }
}

// Copy meeting code to clipboard
function copyMeetingCode() {
    navigator.clipboard.writeText(meetingCode)
        .then(() => {
            showAlert('Meeting code copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showAlert('Failed to copy meeting code', 'error');
        });
}

// Parse URL parameters
function getUrlParameters() {
    const params = {};
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    
    return params;
}

// Generate a shareable meeting link
function generateMeetingLink() {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?code=${meetingCode}`;
}

// Check for meeting code in URL and join automatically
function checkUrlForMeetingCode() {
    const params = getUrlParameters();
    if (params.code) {
        meetingCodeInput.value = params.code;
        // Use a slight delay to ensure DOM is fully loaded
        setTimeout(() => {
            joinMeeting();
        }, 500);
    }
}

// Copy meeting link to clipboard
function copyMeetingLink() {
    const meetingLink = generateMeetingLink();
    navigator.clipboard.writeText(meetingLink)
        .then(() => {
            showAlert('Meeting link copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showAlert('Failed to copy meeting link', 'error');
        });
}

// Socket.io event handlers
socket.on('joined-meeting', () => {
    console.log('Successfully joined meeting:', meetingCode);
    if (isInitiator) {
        createPeerConnection();
    }
});

socket.on('new-user-joined', () => {
    console.log('A new user joined the meeting');
    showAlert('A new participant has joined the meeting', 'info');
    if (isInitiator) {
        startCall();
    }
});

socket.on('offer', data => {
    if (data.meetingCode === meetingCode) {
        console.log('Received offer');
        handleOffer(data.offer);
    }
});

socket.on('answer', data => {
    if (data.meetingCode === meetingCode) {
        console.log('Received answer');
        handleAnswer(data.answer);
    }
});

socket.on('ice-candidate', data => {
    if (data.meetingCode === meetingCode) {
        console.log('Received ICE candidate');
        handleIceCandidate(data.candidate);
    }
});

socket.on('user-disconnected', () => {
    console.log('The other user disconnected');
    showAlert('The other participant has left the meeting', 'info');
    remoteVideo.srcObject = null;
});

// Event listeners
createMeetingButton.addEventListener('click', createMeeting);
joinMeetingButton.addEventListener('click', joinMeeting);
toggleAudioButton.addEventListener('click', toggleAudio);
toggleVideoButton.addEventListener('click', toggleVideo);
endCallButton.addEventListener('click', endCall);
copyMeetingCodeButton.addEventListener('click', copyMeetingCode);
// Add copy link button event listener
document.getElementById('copyMeetingLink').addEventListener('click', copyMeetingLink);
toggleBackgroundButton.addEventListener('click', toggleVirtualBackground);
uploadBackgroundButton.addEventListener('click', uploadCustomBackground);
customBackgroundInput.addEventListener('change', handleCustomBackgroundSelected);
backgroundModelSelect.addEventListener('change', async () => {
    // Store previous model name
    const oldModel = virtualBackground.model;
    
    // Save metrics from the old model before loading the new one
    resetAndSaveMetrics(oldModel);
    
    // Load the new model if virtual background is enabled
    if (virtualBackground.enabled) {
        await loadSelectedModel();
    }
});

// Background option selection
document.querySelectorAll('.background-option').forEach(option => {
    option.addEventListener('click', () => {
        const bgType = option.dataset.bg;
        if (bgType === 'none') {
            toggleVirtualBackground(); // Turn off virtual background
        } else {
            if (!virtualBackground.enabled) {
                toggleVirtualBackground(); // Turn on virtual background
            }
            setVirtualBackgroundType(bgType);
        }
    });
});

// Update metrics when model changes
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

// Show metrics comparison alert
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

// Update the UI with comparison metrics
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

// Create comparison metrics section
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
        
        // Update the table with model data
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
    } else {
        comparisonSection.classList.add('hide');
    }
}

// Gather and display WebRTC stats
function setupWebRTCStats() {
    // Create stats overlay for local video
    const localStatsOverlay = document.createElement('div');
    localStatsOverlay.className = 'stats-overlay';
    localStatsOverlay.id = 'localStatsOverlay';
    
    // Create stats overlay for remote video
    const remoteStatsOverlay = document.createElement('div');
    remoteStatsOverlay.className = 'stats-overlay';
    remoteStatsOverlay.id = 'remoteStatsOverlay';
    
    // Add overlays to video wrappers
    const localVideoWrapper = document.querySelector('.video-wrapper:first-child');
    const remoteVideoWrapper = document.querySelector('.video-wrapper:last-child');
    
    if (localVideoWrapper) localVideoWrapper.appendChild(localStatsOverlay);
    if (remoteVideoWrapper) remoteVideoWrapper.appendChild(remoteStatsOverlay);
    
    // Add hover event listeners
    if (localVideoWrapper) {
        localVideoWrapper.addEventListener('mouseenter', () => {
            updateLocalStats();
            localStatsOverlay.style.opacity = '1';
            // Update stats every second while hovering
            virtualBackground.localStatsInterval = setInterval(updateLocalStats, 1000);
        });
        
        localVideoWrapper.addEventListener('mouseleave', () => {
            localStatsOverlay.style.opacity = '0';
            clearInterval(virtualBackground.localStatsInterval);
        });
    }
    
    if (remoteVideoWrapper) {
        remoteVideoWrapper.addEventListener('mouseenter', () => {
            updateRemoteStats();
            remoteStatsOverlay.style.opacity = '1';
            // Update stats every second while hovering
            virtualBackground.remoteStatsInterval = setInterval(updateRemoteStats, 1000);
        });
        
        remoteVideoWrapper.addEventListener('mouseleave', () => {
            remoteStatsOverlay.style.opacity = '0';
            clearInterval(virtualBackground.remoteStatsInterval);
        });
    }
}

// Update remote WebRTC stats
async function updateRemoteStats() {
    const statsOverlay = document.getElementById('remoteStatsOverlay');
    if (!statsOverlay || !peerConnection) return;
    
    let statsHtml = '<div class="stats-title">Remote Stream</div>';
    
    try {
        // Display resolution if available
        if (remoteVideo && remoteVideo.videoWidth) {
            statsHtml += `
                <div class="stats-item">
                    <span>Resolution:</span> ${remoteVideo.videoWidth}×${remoteVideo.videoHeight}
                </div>
            `;
        }
        
        const stats = await peerConnection.getStats();
        let inboundVideoStats, connectionStats;
        
        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                inboundVideoStats = report;
            } else if (report.type === 'transport') {
                connectionStats = report;
            }
        });
        
        if (inboundVideoStats) {
            if (inboundVideoStats.bytesReceived) {
                statsHtml += `
                    <div class="stats-item">
                        <span>Received:</span> ${formatBytes(inboundVideoStats.bytesReceived || 0)}
                    </div>
                `;
            }
            
            // Calculate FPS correctly from stats
            if (inboundVideoStats.framesDecoded && inboundVideoStats.framesReceived) {
                // If we have framesReceived, we can calculate FPS from timestamp delta
                const now = Date.now();
                
                // Store last check time and frames in a property of the videoElement
                if (!remoteVideo.lastStatsCheck) {
                    remoteVideo.lastStatsCheck = {
                        time: now,
                        frames: inboundVideoStats.framesDecoded
                    };
                }
                
                // Calculate time difference in seconds
                const timeDiff = (now - remoteVideo.lastStatsCheck.time) / 1000;
                
                // Only calculate if we have at least 0.5 seconds between checks
                if (timeDiff >= 0.5) {
                    const frameDiff = inboundVideoStats.framesDecoded - remoteVideo.lastStatsCheck.frames;
                    const calculatedFps = Math.round(frameDiff / timeDiff);
                    
                    // Update stored values
                    remoteVideo.lastStatsCheck.time = now;
                    remoteVideo.lastStatsCheck.frames = inboundVideoStats.framesDecoded;
                    
                    // Add to stats display
                    statsHtml += `
                        <div class="stats-item">
                            <span>FPS:</span> ${calculatedFps || 'N/A'}
                        </div>
                    `;
                } else if (remoteVideo.lastStatsCheck.fps) {
                    // Use previously calculated FPS if available
                    statsHtml += `
                        <div class="stats-item">
                            <span>FPS:</span> ${remoteVideo.lastStatsCheck.fps || 'N/A'}
                        </div>
                    `;
                } else {
                    // Fallback to approximate calculation
                    const approximateFps = Math.round(inboundVideoStats.framesDecoded / inboundVideoStats.totalDecodeTime);
                    statsHtml += `
                        <div class="stats-item">
                            <span>FPS:</span> ${approximateFps || 'N/A'}
                        </div>
                    `;
                }
            }
            
            if (inboundVideoStats.packetsLost && inboundVideoStats.packetsReceived) {
                const lossRate = (inboundVideoStats.packetsLost / (inboundVideoStats.packetsReceived + inboundVideoStats.packetsLost) * 100).toFixed(1);
                statsHtml += `
                    <div class="stats-item">
                        <span>Packet Loss:</span> ${lossRate}%
                    </div>
                `;
            }
        }
        
        if (connectionStats && connectionStats.currentRoundTripTime) {
            statsHtml += `
                <div class="stats-item">
                    <span>Latency:</span> ${(connectionStats.currentRoundTripTime * 1000).toFixed(0)} ms
                </div>
            `;
        }
        
    } catch (e) {
        console.error('Error getting remote WebRTC stats:', e);
        statsHtml += '<div class="stats-item error">Error fetching stats</div>';
    }
    
    statsOverlay.innerHTML = statsHtml;
}

// Update local WebRTC stats
async function updateLocalStats() {
    const statsOverlay = document.getElementById('localStatsOverlay');
    if (!statsOverlay) return;
    
    // Format basic local stream info
    let statsHtml = '<div class="stats-title">Local Stream</div>';
    
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];
        
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            statsHtml += `
                <div class="stats-item">
                    <span>Resolution:</span> ${settings.width || 'N/A'}×${settings.height || 'N/A'}
                </div>
            `;
            
            // Use the actual frameRate from settings if available
            if (settings.frameRate) {
                statsHtml += `
                    <div class="stats-item">
                        <span>FPS:</span> ${Math.round(settings.frameRate)}
                    </div>
                `;
            }
        }
        
        if (audioTrack) {
            statsHtml += `
                <div class="stats-item">
                    <span>Audio:</span> ${audioTrack.enabled ? 'On' : 'Muted'}
                </div>
            `;
        }
    }
    
    // Get more details from WebRTC stats API if connection exists
    if (peerConnection) {
        try {
            const stats = await peerConnection.getStats();
            let outboundVideoStats;
            
            stats.forEach(report => {
                if (report.type === 'outbound-rtp' && report.kind === 'video') {
                    outboundVideoStats = report;
                }
            });
            
            if (outboundVideoStats && outboundVideoStats.bytesSent) {
                statsHtml += `
                    <div class="stats-item">
                        <span>Sent:</span> ${formatBytes(outboundVideoStats.bytesSent || 0)}
                    </div>
                `;
                
                // Calculate FPS for outbound stream using frame counts and timestamps
                if (outboundVideoStats.framesSent) {
                    // Similar approach as remote stats
                    const now = Date.now();
                    
                    if (!localVideo.lastStatsCheck) {
                        localVideo.lastStatsCheck = {
                            time: now,
                            frames: outboundVideoStats.framesSent
                        };
                    }
                    
                    // Calculate time difference in seconds
                    const timeDiff = (now - localVideo.lastStatsCheck.time) / 1000;
                    
                    if (timeDiff >= 0.5) {
                        const frameDiff = outboundVideoStats.framesSent - localVideo.lastStatsCheck.frames;
                        const calculatedFps = Math.round(frameDiff / timeDiff);
                        
                        // Save for future reference
                        localVideo.lastStatsCheck.time = now;
                        localVideo.lastStatsCheck.frames = outboundVideoStats.framesSent;
                        localVideo.lastStatsCheck.fps = calculatedFps;
                        
                        // If not already displayed from settings
                        if (!localStream.getVideoTracks()[0]?.getSettings()?.frameRate) {
                            statsHtml += `
                                <div class="stats-item">
                                    <span>FPS:</span> ${calculatedFps || 'N/A'}
                                </div>
                            `;
                        }
                    } else if (localVideo.lastStatsCheck.fps && !localStream.getVideoTracks()[0]?.getSettings()?.frameRate) {
                        // Use previous calculation
                        statsHtml += `
                            <div class="stats-item">
                                <span>FPS:</span> ${localVideo.lastStatsCheck.fps || 'N/A'}
                            </div>
                        `;
                    }
                }
            }
        } catch (e) {
            console.error('Error getting WebRTC stats:', e);
        }
    }
    
    statsOverlay.innerHTML = statsHtml;
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check for meeting code in URL parameters
    checkUrlForMeetingCode();
    
    // Set up WebRTC stats display
    setupWebRTCStats();
});