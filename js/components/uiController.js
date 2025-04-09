// UI Controller for managing DOM elements and event listeners
import { formatBytes, updateDebugInfo } from '../utils/generalUtils.js';
import ModelLabUI from './ModelLabUI.js';

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
        
        // Control buttons - using new icon-based controls
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
        
        // Model selection - removed backgroundModelSelect as we only use MediaPipe now
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
    
    // Set up tooltips for metrics
    setupTooltips();

    return uiElements;
}

/**
 * Setup WebRTC stats display for local and remote videos
 * @param {Object} uiElements - References to UI elements
 */
function setupWebRTCStats(uiElements) {
    // Use existing stats overlays from HTML instead of creating new ones
    const localStatsOverlay = document.getElementById('localStatsOverlay');
    const remoteStatsOverlay = document.getElementById('remoteStatsOverlay');
    
    // Get video wrapper elements
    const localVideoWrapper = uiElements.localVideo.closest('.video-wrapper');
    const remoteVideoWrapper = uiElements.remoteVideo.closest('.video-wrapper');
    
    // Add hover event listeners for local video stats
    if (localVideoWrapper && localStatsOverlay) {
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
    
    // Add hover event listeners for remote video stats
    if (remoteVideoWrapper && remoteStatsOverlay) {
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
 * Set up tooltips for performance metrics and other UI elements
 */
function setupTooltips() {
    // Add tooltip behavior for all tooltip elements
    document.addEventListener('DOMContentLoaded', () => {
        const tooltips = document.querySelectorAll('.tooltip');
        
        tooltips.forEach(tooltip => {
            tooltip.addEventListener('mouseenter', () => {
                const tooltipText = tooltip.querySelector('.tooltiptext');
                if (tooltipText) {
                    tooltipText.style.visibility = 'visible';
                    tooltipText.style.opacity = '1';
                }
            });
            
            tooltip.addEventListener('mouseleave', () => {
                const tooltipText = tooltip.querySelector('.tooltiptext');
                if (tooltipText) {
                    tooltipText.style.visibility = 'hidden';
                    tooltipText.style.opacity = '0';
                }
            });
        });
    });
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
                    <div>Resolution:</div>
                    <span id="remoteResolution">${uiElements.remoteVideo.videoWidth}×${uiElements.remoteVideo.videoHeight}</span>
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
                        <div>Received:</div>
                        <span>${formatBytes(inboundVideoStats.bytesReceived || 0)}</span>
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
                            <div>FPS:</div>
                            <span>${calculatedFps || 'N/A'}</span>
                        </div>
                    `;
                } else if (uiElements.remoteVideo.lastStatsCheck.fps) {
                    // Use previously calculated FPS if available
                    statsHtml += `
                        <div class="stats-item">
                            <div>FPS:</div>
                            <span>${uiElements.remoteVideo.lastStatsCheck.fps || 'N/A'}</span>
                        </div>
                    `;
                } else {
                    // Fallback to approximate calculation
                    const approximateFps = Math.round(inboundVideoStats.framesDecoded / inboundVideoStats.totalDecodeTime);
                    statsHtml += `
                        <div class="stats-item">
                            <div>FPS:</div>
                            <span>${approximateFps || 'N/A'}</span>
                        </div>
                    `;
                }
            }
            
            if (inboundVideoStats.packetsLost && inboundVideoStats.packetsReceived) {
                const lossRate = (inboundVideoStats.packetsLost / (inboundVideoStats.packetsReceived + inboundVideoStats.packetsLost) * 100).toFixed(1);
                statsHtml += `
                    <div class="stats-item">
                        <div>Packet Loss:</div>
                        <span>${lossRate}%</span>
                    </div>
                `;
            }
            
            // Update packets element in HTML
            statsHtml += `
                <div class="stats-item">
                    <div>Packets:</div>
                    <span id="remotePackets">${inboundVideoStats.packetsReceived || '0'}</span>
                </div>
            `;
            
            // Update bitrate
            if (inboundVideoStats.bytesReceived) {
                const now = Date.now();
                if (!uiElements.remoteVideo.lastBytesCheck) {
                    uiElements.remoteVideo.lastBytesCheck = {
                        time: now,
                        bytes: inboundVideoStats.bytesReceived
                    };
                }
                
                const timeDiff = (now - uiElements.remoteVideo.lastBytesCheck.time) / 1000;
                if (timeDiff >= 0.5) {
                    const bytesDiff = inboundVideoStats.bytesReceived - uiElements.remoteVideo.lastBytesCheck.bytes;
                    const bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000); // kbps
                    
                    uiElements.remoteVideo.lastBytesCheck = {
                        time: now,
                        bytes: inboundVideoStats.bytesReceived
                    };
                    
                    statsHtml += `
                        <div class="stats-item">
                            <div>Bitrate:</div>
                            <span id="remoteBitrate">${bitrate} kbps</span>
                        </div>
                    `;
                }
            }
        }
        
        if (connectionStats && connectionStats.currentRoundTripTime) {
            statsHtml += `
                <div class="stats-item">
                    <div>Latency:</div>
                    <span id="remoteLatency">${(connectionStats.currentRoundTripTime * 1000).toFixed(0)} ms</span>
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
                    <div>Resolution:</div>
                    <span id="localResolution">${settings.width || 'N/A'}×${settings.height || 'N/A'}</span>
                </div>
            `;
            
            // Always use the native video frame rate for display so stats match
            // This ensures the displayed FPS is consistent with the video source
            if (settings.frameRate) {
                statsHtml += `
                    <div class="stats-item">
                        <div>FPS:</div>
                        <span>${Math.round(settings.frameRate)}</span>
                    </div>
                `;
            }
        }
        
        if (audioTrack) {
            statsHtml += `
                <div class="stats-item">
                    <div>Audio:</div>
                    <span>${audioTrack.enabled ? 'On' : 'Muted'}</span>
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
                        <div>Sent:</div>
                        <span>${formatBytes(outboundVideoStats.bytesSent || 0)}</span>
                    </div>
                `;
                
                // Update packets sent
                statsHtml += `
                    <div class="stats-item">
                        <div>Packets Sent:</div>
                        <span id="localPackets">${outboundVideoStats.packetsSent || '0'}</span>
                    </div>
                `;
                
                // Calculate bitrate
                const now = Date.now();
                if (!uiElements.localVideo.lastBytesCheck) {
                    uiElements.localVideo.lastBytesCheck = {
                        time: now,
                        bytes: outboundVideoStats.bytesSent
                    };
                }
                
                const timeDiff = (now - uiElements.localVideo.lastBytesCheck.time) / 1000;
                if (timeDiff >= 0.5) {
                    const bytesDiff = outboundVideoStats.bytesSent - uiElements.localVideo.lastBytesCheck.bytes;
                    const bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000); // kbps
                    
                    uiElements.localVideo.lastBytesCheck = {
                        time: now,
                        bytes: outboundVideoStats.bytesSent
                    };
                    
                    statsHtml += `
                        <div class="stats-item">
                            <div>Bitrate:</div>
                            <span id="localBitrate">${bitrate} kbps</span>
                        </div>
                    `;
                }
                
                // Add codec info if available
                if (outboundVideoStats.codecId) {
                    stats.forEach(report => {
                        if (report.id === outboundVideoStats.codecId) {
                            statsHtml += `
                                <div class="stats-item">
                                    <div>Codec:</div>
                                    <span id="localCodec">${report.mimeType.split('/')[1]}</span>
                                </div>
                            `;
                        }
                    });
                }
                
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
                                    <div>FPS:</div>
                                    <span>${calculatedFps || 'N/A'}</span>
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
                                    <div>FPS:</div>
                                    <span>${uiElements.localVideo.lastStatsCheck.fps || 'N/A'}</span>
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