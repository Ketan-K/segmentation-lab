// Socket.io service for handling real-time communication

/**
 * Initialize socket.io connection and event handlers
 * @returns {Object} - The socket instance and event handlers
 */
export function initSocket() {
    // Connect to signaling server
    const socket = io();
    
    return socket;
}