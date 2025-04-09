// Main application entry point - imports and initializes all modules

// Import model implementations
import BodyPixModel from './models/BodyPixModel.js';
import MediaPipeModel from './models/MediaPipeModel.js';
import WebGLModel from './models/WebGLModel.js';
import SAM2Model from './models/SAM2Model.js';

// Import services
import { initSocket } from './js/services/socketService.js';
import { setupWebRTCConnection } from './js/services/webrtcService.js';
import { initVirtualBackground } from './js/services/backgroundService.js';

// Import UI components
import { initUI } from './js/components/uiController.js';
import { setupPerformanceMetrics } from './js/components/performanceMetrics.js';
import { setupEventHandlers } from './js/components/eventHandlers.js';

// Import utilities
import { showAlert } from './js/utils/alertUtils.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize socket connection
    const socket = initSocket();
    
    // Initialize UI components and event listeners
    const uiElements = initUI();
    
    // Initialize virtual background service
    const backgroundService = initVirtualBackground(uiElements);
    
    // Initialize WebRTC service
    const webrtcService = setupWebRTCConnection(socket, uiElements, backgroundService);
    
    // Set up performance metrics
    setupPerformanceMetrics(uiElements, backgroundService);
    
    // Set up event handlers for UI elements
    setupEventHandlers(uiElements, webrtcService, backgroundService);
    
    // Check for meeting code in URL parameters
    webrtcService.checkUrlForMeetingCode();
});