// Event handler connections between UI elements and their functionality

/**
 * Connect UI elements to their respective handler functions
 * @param {Object} uiElements - UI element references
 * @param {Object} webrtcService - WebRTC service
 * @param {Object} backgroundService - Background service
 */
export function setupEventHandlers(uiElements, webrtcService, backgroundService) {
    // WebRTC call control buttons
    uiElements.createMeetingButton.addEventListener('click', () => {
        webrtcService.createMeeting();
    });
    
    uiElements.joinMeetingButton.addEventListener('click', () => {
        webrtcService.joinMeeting();
    });
    
    uiElements.endCallButton.addEventListener('click', () => {
        webrtcService.endCall();
    });
    
    uiElements.toggleAudioButton.addEventListener('click', () => {
        webrtcService.toggleAudio();
    });
    
    uiElements.toggleVideoButton.addEventListener('click', () => {
        webrtcService.toggleVideo();
    });
    
    // Meeting code buttons
    uiElements.copyMeetingCodeButton.addEventListener('click', () => {
        webrtcService.copyMeetingCode();
    });
    
    document.getElementById('copyMeetingLink')?.addEventListener('click', () => {
        webrtcService.copyMeetingLink();
    });
    
    // Add any other event handlers from the original app.js that might be missing
    console.log('Event handlers initialized successfully');
}