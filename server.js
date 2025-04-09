const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('.'));

// Keep track of meetings and their participants
const meetings = {};

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    let currentMeetingCode = null;

    // Create a new meeting
    socket.on('create-meeting', (meetingCode) => {
        currentMeetingCode = meetingCode;
        
        // Initialize meeting if it doesn't exist
        if (!meetings[meetingCode]) {
            meetings[meetingCode] = { participants: new Set() };
        }
        
        // Join the socket to the meeting room
        socket.join(meetingCode);
        meetings[meetingCode].participants.add(socket.id);
        
        console.log(`User ${socket.id} created meeting ${meetingCode}`);
        socket.emit('joined-meeting');
    });

    // Join an existing meeting
    socket.on('join-meeting', (meetingCode) => {
        currentMeetingCode = meetingCode;
        
        // Check if meeting exists
        if (!meetings[meetingCode]) {
            meetings[meetingCode] = { participants: new Set() };
        }
        
        // Join the socket to the meeting room
        socket.join(meetingCode);
        meetings[meetingCode].participants.add(socket.id);
        
        console.log(`User ${socket.id} joined meeting ${meetingCode}`);
        socket.emit('joined-meeting');
        
        // Notify other participants in the meeting
        socket.to(meetingCode).emit('new-user-joined');
    });

    // Handle end call event
    socket.on('end-call', () => {
        if (currentMeetingCode && meetings[currentMeetingCode]) {
            // Notify other participants in the meeting first
            socket.to(currentMeetingCode).emit('call-ended', socket.id);
            
            // Remove user from meeting
            meetings[currentMeetingCode].participants.delete(socket.id);
            
            // Clean up empty meetings
            if (meetings[currentMeetingCode].participants.size === 0) {
                delete meetings[currentMeetingCode];
                console.log(`Meeting ${currentMeetingCode} deleted (no participants)`);
            }
            
            // Leave the socket room
            socket.leave(currentMeetingCode);
            
            // Reset the meeting code
            currentMeetingCode = null;
        }
    });

    // Handle offer signal
    socket.on('offer', (data) => {
        console.log(`Offer from ${socket.id} in meeting ${data.meetingCode}`);
        socket.to(data.meetingCode).emit('offer', data);
    });

    // Handle answer signal
    socket.on('answer', (data) => {
        console.log(`Answer from ${socket.id} in meeting ${data.meetingCode}`);
        socket.to(data.meetingCode).emit('answer', data);
    });

    // Handle ICE candidate signal
    socket.on('ice-candidate', (data) => {
        console.log(`ICE candidate from ${socket.id} in meeting ${data.meetingCode}`);
        socket.to(data.meetingCode).emit('ice-candidate', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        
        // Remove from current meeting if any
        if (currentMeetingCode && meetings[currentMeetingCode]) {
            meetings[currentMeetingCode].participants.delete(socket.id);
            
            // Notify other participants
            socket.to(currentMeetingCode).emit('user-disconnected', socket.id);
            
            // Clean up empty meetings
            if (meetings[currentMeetingCode].participants.size === 0) {
                delete meetings[currentMeetingCode];
                console.log(`Meeting ${currentMeetingCode} deleted (no participants)`);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running at http://localhost:${PORT}`);
});