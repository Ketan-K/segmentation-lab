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
    
    // Audio/video toggle handlers - updated for icon buttons
    uiElements.toggleAudioButton.addEventListener('click', () => {
        webrtcService.toggleAudio();
    });
    
    uiElements.toggleVideoButton.addEventListener('click', () => {
        webrtcService.toggleVideo();
    });
    
    // Meeting code actions
    uiElements.copyMeetingCodeButton.addEventListener('click', () => {
        webrtcService.copyMeetingCode();
    });
    
    document.getElementById('copyMeetingLink')?.addEventListener('click', () => {
        webrtcService.copyMeetingLink();
    });
    
    // Background options (new selector)
    document.querySelectorAll('.bg-option').forEach(option => {
        option.addEventListener('click', () => {
            const bgType = option.dataset.bg;
            
            // Skip if this is the upload button
            if (option.id === 'uploadBackground') return;
            
            if (bgType === 'none') {
                if (backgroundService.isEnabled()) {
                    backgroundService.toggle(); // Turn off virtual background
                }
            } else {
                if (!backgroundService.isEnabled()) {
                    backgroundService.toggle(); // Turn on virtual background
                }
                backgroundService.setType(bgType);
            }
        });
    });
    
    // Video overlay controls
    const toggleAudioOverlay = document.getElementById('toggleAudioOverlay');
    if (toggleAudioOverlay) {
        toggleAudioOverlay.addEventListener('click', () => {
            webrtcService.toggleAudio();
            // Sync the state with the main button
            if (uiElements.toggleAudioButton) {
                uiElements.toggleAudioButton.classList.toggle('active');
            }
        });
    }
    
    const toggleVideoOverlay = document.getElementById('toggleVideoOverlay');
    if (toggleVideoOverlay) {
        toggleVideoOverlay.addEventListener('click', () => {
            webrtcService.toggleVideo();
            // Sync the state with the main button
            if (uiElements.toggleVideoButton) {
                uiElements.toggleVideoButton.classList.toggle('active');
            }
        });
    }
    
    const toggleBackgroundOverlay = document.getElementById('toggleBackgroundOverlay');
    if (toggleBackgroundOverlay) {
        toggleBackgroundOverlay.addEventListener('click', () => {
            backgroundService.toggle();
            // Sync the state with the main button
            if (uiElements.toggleBackgroundButton) {
                uiElements.toggleBackgroundButton.classList.toggle('active');
            }
        });
    }
    
    // Make the overlay stats appear on hover
    const localVideoWrapper = document.querySelector('.video-wrapper');
    const localVideoStats = document.getElementById('localVideoStats');
    if (localVideoWrapper && localVideoStats) {
        localVideoWrapper.addEventListener('mouseenter', () => {
            localVideoStats.style.opacity = '1';
        });
        
        localVideoWrapper.addEventListener('mouseleave', () => {
            localVideoStats.style.opacity = '0';
        });
    }
    
    const remoteVideoWrapper = document.querySelectorAll('.video-wrapper')[1];
    const remoteVideoStats = document.getElementById('remoteVideoStats');
    if (remoteVideoWrapper && remoteVideoStats) {
        remoteVideoWrapper.addEventListener('mouseenter', () => {
            remoteVideoStats.style.opacity = '1';
        });
        
        remoteVideoWrapper.addEventListener('mouseleave', () => {
            remoteVideoStats.style.opacity = '0';
        });
    }
    
    console.log('Event handlers initialized successfully');
}