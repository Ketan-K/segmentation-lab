// UI Controller for managing DOM elements and event listeners
import { formatBytes, updateDebugInfo } from '../utils/generalUtils.js';

/**
 * Initializes UI elements and returns references to them
 * @returns {Object} - References to UI elements
 */
export function initUI() {
    // Get all DOM elements
    const uiElements = {
        // Video elements
        localVideo: document.getElementById('localVideo'),
        remoteVideo: document.getElementById('remoteVideo'),
        localCanvas: document.getElementById('localCanvas'),
        
        // Control buttons
        toggleAudioButton: document.getElementById('toggleAudio'),
        toggleVideoButton: document.getElementById('toggleVideo'),
        endCallButton: document.getElementById('endCall'),
        createMeetingButton: document.getElementById('createMeeting'),
        joinMeetingButton: document.getElementById('joinMeeting'),
        toggleBackgroundButton: document.getElementById('toggleBackground'),
        uploadBackgroundButton: document.getElementById('uploadBackground'),
        
        // Meeting code elements
        meetingCodeInput: document.getElementById('meetingCodeInput'),
        meetingCodeDisplay: document.getElementById('meetingCodeDisplay'),
        copyMeetingCodeButton: document.getElementById('copyMeetingCode'),
        
        // Panels
        setupPanel: document.getElementById('setup-panel'),
        callPanel: document.getElementById('call-panel'),
        backgroundSelector: document.getElementById('backgroundSelector'),
        customBackgroundInput: document.getElementById('customBackground'),
        
        // Model selection
        backgroundModelSelect: document.getElementById('backgroundModel'),
        modelSelector: document.getElementById('modelSelector'),
        
        // Performance metrics
        performanceMetrics: document.getElementById('performanceMetrics'),
        segmentationTimeEl: document.getElementById('segmentationTime'),
        frameProcessingTimeEl: document.getElementById('frameProcessingTime'),
        fpsEl: document.getElementById('fps'),
        currentModelEl: document.getElementById('currentModel'),
    };

    // Set up WebRTC stats display
    setupWebRTCStats(uiElements);
    
    return uiElements;
}

/**
 * Setup WebRTC stats display for local and remote videos
 * @param {Object} uiElements - References to UI elements
 */
function setupWebRTCStats(uiElements) {
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
            updateLocalStats(uiElements);
            localStatsOverlay.style.opacity = '1';
            // Update stats every second while hovering
            uiElements.localStatsInterval = setInterval(() => updateLocalStats(uiElements), 1000);
        });
        
        localVideoWrapper.addEventListener('mouseleave', () => {
            localStatsOverlay.style.opacity = '0';
            clearInterval(uiElements.localStatsInterval);
        });
    }
    
    if (remoteVideoWrapper) {
        remoteVideoWrapper.addEventListener('mouseenter', () => {
            updateRemoteStats(uiElements);
            remoteStatsOverlay.style.opacity = '1';
            // Update stats every second while hovering
            uiElements.remoteStatsInterval = setInterval(() => updateRemoteStats(uiElements), 1000);
        });
        
        remoteVideoWrapper.addEventListener('mouseleave', () => {
            remoteStatsOverlay.style.opacity = '0';
            clearInterval(uiElements.remoteStatsInterval);
        });
    }
}

/**
 * Update remote WebRTC stats
 * @param {Object} uiElements - References to UI elements
 */
async function updateRemoteStats(uiElements) {
    const statsOverlay = document.getElementById('remoteStatsOverlay');
    if (!statsOverlay || !window.peerConnection) return;
    
    let statsHtml = '<div class="stats-title">Remote Stream</div>';
    
    try {
        // Display resolution if available
        if (uiElements.remoteVideo && uiElements.remoteVideo.videoWidth) {
            statsHtml += `
                <div class="stats-item">
                    <span>Resolution:</span> ${uiElements.remoteVideo.videoWidth}×${uiElements.remoteVideo.videoHeight}
                </div>
            `;
        }
        
        const stats = await window.peerConnection.getStats();
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
                if (!uiElements.remoteVideo.lastStatsCheck) {
                    uiElements.remoteVideo.lastStatsCheck = {
                        time: now,
                        frames: inboundVideoStats.framesDecoded
                    };
                }
                
                // Calculate time difference in seconds
                const timeDiff = (now - uiElements.remoteVideo.lastStatsCheck.time) / 1000;
                
                // Only calculate if we have at least 0.5 seconds between checks
                if (timeDiff >= 0.5) {
                    const frameDiff = inboundVideoStats.framesDecoded - uiElements.remoteVideo.lastStatsCheck.frames;
                    const calculatedFps = Math.round(frameDiff / timeDiff);
                    
                    // Update stored values
                    uiElements.remoteVideo.lastStatsCheck.time = now;
                    uiElements.remoteVideo.lastStatsCheck.frames = inboundVideoStats.framesDecoded;
                    
                    // Add to stats display
                    statsHtml += `
                        <div class="stats-item">
                            <span>FPS:</span> ${calculatedFps || 'N/A'}
                        </div>
                    `;
                } else if (uiElements.remoteVideo.lastStatsCheck.fps) {
                    // Use previously calculated FPS if available
                    statsHtml += `
                        <div class="stats-item">
                            <span>FPS:</span> ${uiElements.remoteVideo.lastStatsCheck.fps || 'N/A'}
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

/**
 * Update local WebRTC stats
 * @param {Object} uiElements - References to UI elements
 */
async function updateLocalStats(uiElements) {
    const statsOverlay = document.getElementById('localStatsOverlay');
    if (!statsOverlay) return;
    
    // Format basic local stream info
    let statsHtml = '<div class="stats-title">Local Stream</div>';
    
    if (uiElements.localVideo && uiElements.localVideo.srcObject) {
        const localStream = uiElements.localVideo.srcObject;
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];
        
        if (videoTrack) {
            const settings = videoTrack.getSettings();
            statsHtml += `
                <div class="stats-item">
                    <span>Resolution:</span> ${settings.width || 'N/A'}×${settings.height || 'N/A'}
                </div>
            `;
            
            // Always use the native video frame rate for display so stats match
            // This ensures the displayed FPS is consistent with the video source
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
    if (window.peerConnection) {
        try {
            const stats = await window.peerConnection.getStats();
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
                    
                    if (!uiElements.localVideo.lastStatsCheck) {
                        uiElements.localVideo.lastStatsCheck = {
                            time: now,
                            frames: outboundVideoStats.framesSent
                        };
                    }
                    
                    // Calculate time difference in seconds
                    const timeDiff = (now - uiElements.localVideo.lastStatsCheck.time) / 1000;
                    
                    if (timeDiff >= 0.5) {
                        const frameDiff = outboundVideoStats.framesSent - uiElements.localVideo.lastStatsCheck.frames;
                        const calculatedFps = Math.round(frameDiff / timeDiff);
                        
                        // Save for future reference
                        uiElements.localVideo.lastStatsCheck.time = now;
                        uiElements.localVideo.lastStatsCheck.frames = outboundVideoStats.framesSent;
                        uiElements.localVideo.lastStatsCheck.fps = calculatedFps;
                        
                        // If not already displayed from settings
                        const localStream = uiElements.localVideo.srcObject;
                        const videoTrack = localStream?.getVideoTracks()[0];
                        if (!videoTrack?.getSettings()?.frameRate) {
                            statsHtml += `
                                <div class="stats-item">
                                    <span>FPS:</span> ${calculatedFps || 'N/A'}
                                </div>
                            `;
                        }
                    } else if (uiElements.localVideo.lastStatsCheck.fps) {
                        const localStream = uiElements.localVideo.srcObject;
                        const videoTrack = localStream?.getVideoTracks()[0];
                        // Use previous calculation if needed
                        if (!videoTrack?.getSettings()?.frameRate) {
                            statsHtml += `
                                <div class="stats-item">
                                    <span>FPS:</span> ${uiElements.localVideo.lastStatsCheck.fps || 'N/A'}
                                </div>
                            `;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error getting WebRTC stats:', e);
        }
    }
    
    statsOverlay.innerHTML = statsHtml;
}