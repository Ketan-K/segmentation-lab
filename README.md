# Segmentation Lab

A WebRTC-based video conferencing application that serves as a testing laboratory for multiple AI-powered virtual background segmentation technologies. Compare and evaluate SAM2 (Segment Anything Model 2), BodyPix, MediaPipe, and WebGL models in real-time.

## Features

- 🧪 Test and compare multiple AI segmentation models in real-time
- 📊 Detailed performance metrics for each model
- 🔄 Easy switching between models during a call
- 🎥 Real-time video conferencing using WebRTC
- 🔗 Easy meeting creation and joining with shareable meeting codes
- 🖼️ Multiple background options with support for:
  - SAM2 (Segment Anything Model 2)
  - MediaPipe Selfie Segmentation
  - TensorFlow BodyPix
  - WebGL-based segmentation
- 🏝️ Built-in background images (beach, office) and custom background upload
- 🎛️ Audio/video controls

## Getting Started

### Prerequisites

- Node.js (16+)
- Modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/sam2-webrtc.git
   cd sam2-webrtc
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Starting a Meeting

1. Click "Create Meeting" on the home page
2. Grant camera and microphone permissions when prompted
3. Share the generated meeting code with others

### Joining a Meeting

1. Enter the meeting code in the "Join Meeting" input field
2. Click "Join Meeting"
3. Grant camera and microphone permissions when prompted

### Using Virtual Backgrounds

1. During a call, click "Virtual Background" button
2. Select a segmentation model from the dropdown (MediaPipe is recommended for most devices)
3. Choose a background type:
   - None (blurred background)
   - Beach
   - Office
   - Custom (upload your own image)

## Segmentation Models

### SAM2 Model
- Based on Meta's Segment Anything Model 2
- Highest quality segmentation
- More resource-intensive

### MediaPipe Model
- Uses Google's MediaPipe Selfie Segmentation
- Good balance of performance and quality
- Works well on most devices

### BodyPix Model
- TensorFlow.js-based segmentation
- Reasonable quality
- Higher resource usage

### WebGL Model
- Custom WebGL-based segmentation
- Fastest performance
- Lower quality than other models

## Performance Metrics

The application provides real-time performance metrics for each segmentation model:
- FPS (Frames Per Second)
- Segmentation Time (ms)
- Frame Processing Time (ms)

This allows you to compare the efficiency of different models on your device.

## Project Structure

```
sam2-webrtc/
├── app.js             # Main client-side application logic
├── index.html         # Main HTML file
├── package.json       # Project dependencies
├── server.js          # WebRTC signaling server
├── assets/            # Background images
│   ├── beach.png
│   └── office.png
└── models/            # Segmentation model implementations
    ├── BaseBackgroundModel.js
    ├── BodyPixModel.js
    ├── MediaPipeModel.js
    ├── SAM2Model.js
    └── WebGLModel.js
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [WebRTC](https://webrtc.org/)
- [Socket.io](https://socket.io/)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [MediaPipe](https://mediapipe.dev/)
- [Segment Anything Model 2](https://segment-anything.com/)