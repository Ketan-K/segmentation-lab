// WebRTC service for handling peer connections and media streams
import { showAlert } from '../utils/alertUtils.js';
import { generateMeetingCode, getUrlParameters, updateDebugInfo } from '../utils/generalUtils.js';

/**
 * Sets up WebRTC connection handling
 * @param {Object} socket - Socket.io connection
 * @param {Object} uiElements - UI elements references
 * @param {Object} backgroundService - Virtual background service
 * @returns {Object} - WebRTC service methods
 */
export function setupWebRTCConnection(socket, uiElements, backgroundService) {
    // WebRTC variables
    let localStream;
    let peerConnection;
    let meetingCode = '';
    let isInitiator = false;

    // STUN/TURN servers configuration
    const configuration = { 
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ] 
    };

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
                uiElements.toggleAudioButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                uiElements.toggleAudioButton.classList.add('active');
                uiElements.toggleAudioButton.title = 'Unmute Audio';
            }
            
            uiElements.localVideo.srcObject = localStream;
            
            // Wait for video to be ready to get dimensions
            await new Promise(resolve => {
                if (uiElements.localVideo.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                    resolve();
                } else {
                    uiElements.localVideo.addEventListener('loadeddata', () => {
                        updateDebugInfo(`Video loaded: ${uiElements.localVideo.videoWidth}x${uiElements.localVideo.videoHeight}`);
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
            if (!uiElements.localVideo.videoWidth || !uiElements.localVideo.videoHeight) {
                updateDebugInfo('Video dimensions not available yet, using defaults: 640x480');
                uiElements.localCanvas.width = 640;
                uiElements.localCanvas.height = 480;
            } else {
                uiElements.localCanvas.width = uiElements.localVideo.videoWidth;
                uiElements.localCanvas.height = uiElements.localVideo.videoHeight;
                updateDebugInfo(`Canvas initialized to ${uiElements.localCanvas.width}x${uiElements.localCanvas.height}`);
            }
            
            backgroundService.setContext(uiElements.localCanvas.getContext('2d'));
            
            // Show model selector after video is initialized
            uiElements.modelSelector.classList.remove('hide');
            
            updateDebugInfo('Media devices initialized successfully. Video dimensions: ' + 
                            uiElements.localCanvas.width + 'x' + uiElements.localCanvas.height);
            
            return true;
        } catch (error) {
            updateDebugInfo('Error accessing media devices: ' + error.message);
            showAlert('Error accessing camera and microphone. Please make sure you have granted the necessary permissions.', 'error');
            return false;
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
            // Only log critical state changes
            const state = peerConnection.iceConnectionState;
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                console.log('ICE connection state:', state);
            }
        };
        
        // Handle receiving remote stream
        peerConnection.ontrack = event => {
            if (uiElements.remoteVideo.srcObject !== event.streams[0]) {
                uiElements.remoteVideo.srcObject = event.streams[0];
            }
        };
    }

    // Create a meeting
    async function createMeeting() {
        if (!await initializeMedia()) return;

        isInitiator = true;
        meetingCode = generateMeetingCode();
        uiElements.meetingCodeDisplay.textContent = meetingCode;
        
        // Join the meeting room
        socket.emit('create-meeting', meetingCode);
        
        // Show the call panel
        uiElements.setupPanel.classList.add('hide');
        uiElements.callPanel.classList.remove('hide');
        
        showAlert(`Created new meeting with code: ${meetingCode}`, 'success', 'Meeting Created');
    }

    // Join a meeting
    async function joinMeeting() {
        const code = uiElements.meetingCodeInput.value.trim().toUpperCase();
        if (!code) {
            showAlert('Please enter a meeting code', 'error');
            return;
        }
        
        if (!await initializeMedia()) return;

        isInitiator = false;
        meetingCode = code;
        uiElements.meetingCodeDisplay.textContent = meetingCode;
        
        // Join the meeting room
        socket.emit('join-meeting', meetingCode);
        
        // Show the call panel
        uiElements.setupPanel.classList.add('hide');
        uiElements.callPanel.classList.remove('hide');
        
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
            
            // Update UI - simplified for icon button
            if (isEnabled) {
                uiElements.toggleAudioButton.innerHTML = '<i class="fas fa-microphone"></i>';
                uiElements.toggleAudioButton.classList.remove('active');
                uiElements.toggleAudioButton.title = 'Mute Audio';
            } else {
                uiElements.toggleAudioButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                uiElements.toggleAudioButton.classList.add('active');
                uiElements.toggleAudioButton.title = 'Unmute Audio';
            }
        }
    }

    // Toggle video
    function toggleVideo() {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length === 0) return;
            
            const isEnabled = !videoTracks[0].enabled;
            videoTracks[0].enabled = isEnabled;
            
            // Update UI - simplified for icon button
            if (isEnabled) {
                uiElements.toggleVideoButton.innerHTML = '<i class="fas fa-video"></i>';
                uiElements.toggleVideoButton.classList.remove('active');
                uiElements.toggleVideoButton.title = 'Turn Off Camera';
            } else {
                uiElements.toggleVideoButton.innerHTML = '<i class="fas fa-video-slash"></i>';
                uiElements.toggleVideoButton.classList.add('active');
                uiElements.toggleVideoButton.title = 'Turn On Camera';
            }
            
            // If video was turned off, disable virtual background
            if (!isEnabled && backgroundService.isEnabled()) {
                backgroundService.toggle(); // Turn off virtual background
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
        
        uiElements.localVideo.srcObject = null;
        uiElements.remoteVideo.srcObject = null;
        
        // Reset UI
        uiElements.setupPanel.classList.remove('hide');
        uiElements.callPanel.classList.add('hide');
        uiElements.meetingCodeInput.value = '';
        
        // Disable virtual background
        if (backgroundService.isEnabled()) {
            backgroundService.toggle();
        }
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
            uiElements.meetingCodeInput.value = params.code;
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

    // Set up socket event handlers
    socket.on('joined-meeting', () => {
        if (isInitiator) {
            createPeerConnection();
        }
    });

    socket.on('new-user-joined', () => {
        showAlert('A new participant has joined the meeting', 'info');
        if (isInitiator) {
            startCall();
        }
    });

    socket.on('offer', data => {
        if (data.meetingCode === meetingCode) {
            handleOffer(data.offer);
        }
    });

    socket.on('answer', data => {
        if (data.meetingCode === meetingCode) {
            handleAnswer(data.answer);
        }
    });

    socket.on('ice-candidate', data => {
        if (data.meetingCode === meetingCode) {
            handleIceCandidate(data.candidate);
        }
    });

    socket.on('user-disconnected', () => {
        showAlert('The other participant has left the meeting', 'info');
        uiElements.remoteVideo.srcObject = null;
    });

    // Make peerConnection available globally for stats display
    window.peerConnection = peerConnection;

    return {
        createMeeting,
        joinMeeting,
        endCall,
        toggleAudio,
        toggleVideo,
        copyMeetingCode,
        copyMeetingLink,
        checkUrlForMeetingCode,
        getLocalStream: () => localStream,
        getMeetingCode: () => meetingCode
    };
}