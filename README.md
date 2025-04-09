# Segmentation Lab

A WebRTC-based video conferencing application that serves as a testing laboratory for multiple AI-powered virtual background segmentation technologies. Compare and evaluate SAM2 (Segment Anything Model 2), BodyPix, MediaPipe, and WebGL models in real-time.

## Live Demo

Try the application online: [https://segmentation-lab.onrender.com/](https://segmentation-lab.onrender.com/)

## Features

- 🧪 Test and compare multiple AI segmentation models in real-time
- 📊 Detailed performance metrics for each model
- 🔄 Easy switching between models during a call
- 🎥 Real-time video conferencing using WebRTC
- 🔗 Easy meeting creation and joining with shareable meeting codes
- 🖼️ Multiple background options with support for:
  - MediaPipe Selfie Segmentation (currently available)
  - SAM2 (Segment Anything Model 2) - coming soon
  - TensorFlow BodyPix - coming soon
  - WebGL-based segmentation - coming soon
- 🏝️ Built-in background images (beach, office) and custom background upload
- 🎛️ Audio/video controls

## Getting Started

### Prerequisites

- Node.js (16+)
- Modern web browser with WebRTC support (Chrome, Firefox, Edge, Safari)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Ketan-K/segmentation-lab.git
   cd segmentation-lab
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

### Development

This project includes a `.gitignore` file that excludes:
- Node.js dependencies (`node_modules`)
- Environment files (`.env`, etc.)
- Build artifacts
- Log files
- Editor-specific files
- Cache files

For development:
1. Fork or clone the repository
2. Run `npm install` to install dependencies
3. Make your changes
4. Test locally with `npm start`
5. Submit a pull request with your improvements

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
   - None (original background)
   - Blur (blurred background)
   - Beach
   - Office
   - Custom (upload your own image)

## Segmentation Models

### MediaPipe Model
- Uses Google's MediaPipe Selfie Segmentation
- Good balance of performance and quality
- Works well on most devices
- **Currently the only implemented model**

### SAM2 Model (Coming Soon)
- Based on Meta's Segment Anything Model 2
- Highest quality segmentation
- More resource-intensive

### BodyPix Model (Coming Soon)
- TensorFlow.js-based segmentation
- Reasonable quality
- Higher resource usage

### WebGL Model (Coming Soon)
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
segmentation-lab/
├── app.js             # Main client-side application logic
├── index.html         # Main HTML file
├── package.json       # Project dependencies
├── server.js          # WebRTC signaling server
├── styles.css         # Application styles
├── .gitignore         # Git ignore patterns
├── assets/            # Background images
│   ├── beach.png
│   └── office.png
├── js/                # JavaScript modules
│   ├── components/    # UI components
│   │   ├── eventHandlers.js     # Event handling logic
│   │   ├── performanceMetrics.js # Performance measuring utilities
│   │   └── uiController.js      # UI manipulation functions
│   ├── services/      # Services
│   │   ├── backgroundService.js # Background effects processing
│   │   ├── socketService.js     # Socket.io communication
│   │   └── webrtcService.js     # WebRTC connection management
│   └── utils/         # Utility functions
│       ├── alertUtils.js        # Alert/notification utilities
│       └── generalUtils.js      # General helper functions
└── models/            # Segmentation model implementations
    ├── BaseBackgroundModel.js   # Base model class
    └── MediaPipeModel.js        # MediaPipe integration
```

## Connect

- [GitHub Repository](https://github.com/Ketan-K/segmentation-lab)
- [LinkedIn](https://in.linkedin.com/in/ketan-k)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [WebRTC](https://webrtc.org/)
- [Socket.io](https://socket.io/)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [MediaPipe](https://mediapipe.dev/)
- [Segment Anything Model 2](https://segment-anything.com/)