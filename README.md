# Calibration Frontend

React + TypeScript frontend for monocular camera calibration system.

## Features

- **Background Selection**: Real-time background extraction from camera or uploaded video
- **Interactive Calibration**: Click-based point selection on image and map
- **Result Visualization**: View calibration results with RMS error and configuration history

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables (optional):**
   Create `.env` file:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

3. **Run development server:**
   ```bash
   npm start
   ```

   App will open at `http://localhost:3000`

## Build

```bash
npm run build
```

Build output will be in the `build/` directory.

## Pages

### 1. Background Selection (`/background`)
- Start camera or upload video
- Extract background using real-time processing
- Save background for calibration

### 2. Calibration (`/calibration`)
- Click points on background image
- Click corresponding coordinates on map
- Select origin point
- Perform calibration

### 3. Calibration Result (`/calibration-result`)
- View calibration visualization
- See RMS error
- Review all calibration versions
- Recalibrate or finish

## Tech Stack

- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Leaflet** for interactive maps
- **Socket.IO Client** for real-time WebSocket communication

## Project Structure

```
src/
├── components/          # React components (pages)
├── services/           # WebSocket service
├── store/              # Redux store and slices
├── App.tsx             # Main app with routing
└── index.tsx           # App entry point
```
