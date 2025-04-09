// Main application entry point - imports and initializes all modules

// Import services
import { initSocket } from './js/services/socketService.js';
import { setupWebRTCConnection } from './js/services/webrtcService.js';
import { initVirtualBackground } from './js/services/backgroundService.js';
import BackgroundModelFactory from './js/services/BackgroundModelFactory.js';

// Import UI components
import { initUI } from './js/components/uiController.js';
import { setupPerformanceMetrics } from './js/components/performanceMetrics.js';
import { setupEventHandlers } from './js/components/eventHandlers.js';
import ModelLabUI from './js/components/ModelLabUI.js';

// Import utilities
import { showAlert } from './js/utils/alertUtils.js';
import { updateDebugInfo } from './js/utils/generalUtils.js';

// Global debug function
const debug = (message) => {
    console.log(`[WebRTC App] ${message}`);
    updateDebugInfo(message);
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize socket connection
        const socket = initSocket();
        
        // Initialize UI components and event listeners
        const uiElements = initUI();
        
        // Initialize background model factory
        const modelFactory = new BackgroundModelFactory(debug);
        await modelFactory.init();
        debug('Background model factory initialized');
        
        // Make model factory globally available for the backgroundService
        window.modelFactory = modelFactory;
        
        // Initialize virtual background service
        const backgroundService = initVirtualBackground(uiElements);
        
        // Initialize WebRTC service
        const webrtcService = setupWebRTCConnection(socket, uiElements, backgroundService);
        
        // Set up performance metrics
        setupPerformanceMetrics(uiElements, backgroundService);
        
        // Set up event handlers for UI elements
        setupEventHandlers(uiElements, webrtcService, backgroundService);
        
        // Initialize the virtual background lab UI (integrated directly into the existing UI)
        const modelLab = new ModelLabUI(modelFactory, backgroundService, debug);
        await modelLab.init();
        debug('Virtual Background Model Lab initialized and integrated with UI');
        
        // Check for meeting code in URL parameters
        webrtcService.checkUrlForMeetingCode();
        
    } catch (error) {
        console.error('Error initializing application:', error);
        showAlert('Failed to initialize application. Please refresh the page.', 'error');
    }
});