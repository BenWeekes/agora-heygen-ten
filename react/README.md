# Agora Video Avatar Demo

A simple React application that demonstrates integration between Agora RTC and video avatar rendering.

## Features

- Real-time audio streaming with Agora RTC
- Video avatar display from Agora RTC video streams

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- NPM or Yarn

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/agora-video-avatar-demo.git
   cd agora-video-avatar-demo
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create a `.env` file in the project root:

   ```
   # Agora configuration
   REACT_APP_AGENT_ENDPOINT=rest endpoint for token and start agent
   REACT_APP_AGORA_APP_ID=your_agora_app_id
   # Agora configuration optional - will come from AWS lambda
   REACT_APP_AGORA_CHANNEL_NAME=your_channel_name
   REACT_APP_AGORA_TOKEN=
   REACT_APP_AGORA_UID=

   # Video Avatar configuration
   REACT_APP_VIDEO_AVATAR_ID=your_avatar_id
   REACT_APP_VIDEO_AVATAR_PROFILE_BASE=https://your-cdn.com/avatar-photos
   ```



### Running the Application

Start the development server:

```
npm run start
```

The application will be available at [http://localhost:3040](http://localhost:3040).

## Usage

1. Open the application in your browser
2. Click the play button to connect to the Agora channel
3. The video avatar will appear and display video from the RTC stream
4. Use the microphone button in the bottom right to mute/unmute your microphone

## Building for Production

To create a production build:

```
npm run build
```

The build files will be created in the `build` directory.

## Troubleshooting

- If you encounter audio permission issues, ensure your browser has microphone access
- If the avatar doesn't load, check your Agora configuration and network connection
- For connection issues, verify your Agora App ID and token configuration

## License

[MIT](LICENSE)