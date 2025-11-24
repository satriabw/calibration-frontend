import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../store/store';
import {
  setLoading,
  setConnectionStatus,
  handleSessionStarted,
  handleFrameProcessed,
  handleBackgroundSaved,
  handleBackgroundUpdated,
  handleWebSocketError,
  handleConnected,
  handleDisconnected,
  startSessionRequest,
  saveBackgroundRequest,
  resetSession,
  clearSavedBackground,
} from '../store/backgroundSelectionSlice';
import { wsService } from '../services/websocket';
import './BackgroundSelectionPage.css';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error';
  timestamp: Date;
}

const BackgroundSelectionPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  const {
    sessionId,
    isSessionActive,
    currentFrame,
    savedBackground,
    isLoading,
    error,
    success,
    connectionStatus,
    processingStatus,
    hasBackground,
  } = useSelector((state: RootState) => state.backgroundSelection);

  const [isCapturing, setIsCapturing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isUsingVideo, setIsUsingVideo] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureIntervalRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isCapturingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add log entry
  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Setup WebSocket
  useEffect(() => {
    addLog('Setting up WebSocket connection...', 'info');

    const connectToWebSocket = async () => {
      try {
        dispatch(setConnectionStatus('connecting'));
        await wsService.connect();
        dispatch(handleConnected());
        addLog('Connected to server', 'success');
      } catch (error) {
        console.error('Failed to connect:', error);
        dispatch(setConnectionStatus('error'));
        dispatch(handleWebSocketError({ message: 'Failed to connect to server' }));
        addLog('Failed to connect to server', 'error');
      }
    };

    connectToWebSocket();

    wsService.on('connected', (data) => {
      addLog('WebSocket connected', 'success');
      dispatch(handleConnected());
    });

    wsService.on('session_started', (data) => {
      addLog(`Session started: ${data.session_id}`, 'success');
      dispatch(handleSessionStarted(data));
    });

    wsService.on('frame_processed', (data) => {
      dispatch(handleFrameProcessed(data));
      setFrameCount(data.frame_count);
      
      // Calculate FPS
      const now = Date.now();
      const timeDiff = now - lastFrameTimeRef.current;
      if (timeDiff > 0) {
        const calculatedFps = Math.round(1000 / timeDiff);
        setFps(calculatedFps);
      }
      lastFrameTimeRef.current = now;

      // Draw processed frame on canvas
      if (canvasRef.current && data.processed_frame) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            canvasRef.current!.width = img.width;
            canvasRef.current!.height = img.height;
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.processed_frame;
        }
      }
    });

    wsService.on('background_saved', (data) => {
      addLog('Background saved successfully', 'success');
      dispatch(handleBackgroundSaved(data));
    });

    wsService.on('background_updated', (data) => {
      addLog('Background updated', 'success');
      dispatch(handleBackgroundUpdated(data));
    });

    wsService.on('error', (data) => {
      addLog(`Error: ${data.message}`, 'error');
      dispatch(handleWebSocketError(data));
    });

    return () => {
      addLog('Cleaning up WebSocket', 'info');
      stopCapture();
      wsService.off('connected');
      wsService.off('session_started');
      wsService.off('frame_processed');
      wsService.off('background_saved');
      wsService.off('background_updated');
      wsService.off('error');
      wsService.disconnect();
    };
  }, [dispatch]);

  // Sync isCapturingRef with isCapturing state
  useEffect(() => {
    isCapturingRef.current = isCapturing;
  }, [isCapturing]);

  // Frame capture loop effect
  useEffect(() => {
    if (!isCapturing || !videoRef.current || !wsService.isConnected()) {
      return;
    }

    addLog('Starting frame capture loop', 'info');

    const captureLoop = () => {
      if (!isCapturingRef.current || !videoRef.current || !wsService.isConnected()) {
        return;
      }

      try {
        const video = videoRef.current;
        
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
          captureIntervalRef.current = window.setTimeout(captureLoop, 100);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          captureIntervalRef.current = window.setTimeout(captureLoop, 1000);
          return;
        }
        
        ctx.drawImage(video, 0, 0);
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        
        wsService.emit('process_frame', { frame: frameData });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Error capturing frame: ${errorMessage}`, 'error');
      }
      
      // Schedule next frame (1 FPS = 1000ms)
      captureIntervalRef.current = window.setTimeout(captureLoop, 1000);
    };

    // Start the loop
    captureLoop();

    // Cleanup
    return () => {
      if (captureIntervalRef.current !== null) {
        clearTimeout(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [isCapturing]);

  // Start camera and frame capture
  const startCapture = async () => {
    try {
      addLog('Requesting camera access...', 'info');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: false 
      });
      
      if (!videoRef.current) {
        addLog('Video element not found', 'error');
        return;
      }
      
      setLocalStream(stream);
      videoRef.current.srcObject = stream;
      
      // Wait for video metadata to load
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.play().then(() => {
              addLog('Video started playing', 'success');
              resolve();
            }).catch(err => {
              addLog(`Error playing video: ${err.message}`, 'error');
              resolve();
            });
          };
        }
      });

      addLog('Camera access granted', 'success');

      // Start backend session
      dispatch(startSessionRequest());
      wsService.startSession('camera');
      
      // Wait for session to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start frame capture
      setIsCapturing(true);
      addLog('Started capturing frames', 'success');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error starting capture: ${errorMessage}`, 'error');
      alert('Failed to start camera: ' + errorMessage);
    }
  };

  // Stop capture
  const stopCapture = () => {
    addLog('Stopping capture...', 'info');
    setIsCapturing(false);
    
    if (captureIntervalRef.current !== null) {
      clearTimeout(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (videoRef.current && !isUsingVideo) {
      videoRef.current.srcObject = null;
    }
    
    wsService.stopFrameCapture();
    addLog('Capture stopped', 'info');
  };

  // Handle video file upload
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      addLog(`Loading video file: ${file.name}`, 'info');
      
      if (!videoRef.current) {
        addLog('Video element not found', 'error');
        return;
      }

      // Create object URL for the video file
      const videoUrl = URL.createObjectURL(file);
      videoRef.current.src = videoUrl;
      setIsUsingVideo(true);
      
      // Wait for video metadata to load
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current!.play().then(() => {
              addLog('Video loaded and playing', 'success');
              resolve();
            }).catch(err => {
              addLog(`Error playing video: ${err.message}`, 'error');
              resolve();
            });
          };
        }
      });

      // Start backend session
      dispatch(startSessionRequest());
      wsService.startSession('file');
      
      // Wait for session to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start frame capture
      setIsCapturing(true);
      addLog('Started capturing frames from video', 'success');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error loading video: ${errorMessage}`, 'error');
      alert('Failed to load video: ' + errorMessage);
    }
  };

  // Save background
  const handleSaveBackground = () => {
    if (!wsService.isConnected() || !sessionId) {
      alert('No active session');
      return;
    }

    addLog('Saving background...', 'info');
    dispatch(saveBackgroundRequest());
    wsService.saveBackground();
  };

  // Update background
  const handleUpdateBackground = () => {
    if (!wsService.isConnected() || !videoRef.current) {
      alert('Not connected');
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0);
      const frameData = canvas.toDataURL('image/jpeg', 0.8);
      
      wsService.updateBackground(frameData);
      addLog('Updating background with current frame...', 'info');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error updating background: ${errorMessage}`, 'error');
    }
  };

  // Handle proceed to calibration
  const handleProceedToCalibration = async () => {
    console.log('Proceeding to calibration with background:', savedBackground);
    addLog('Ending session and proceeding to calibration...', 'info');
    
    try {
      // Stop any ongoing capture
      stopCapture();
      
      // Disconnect WebSocket (will automatically call end_session)
      wsService.disconnect();
      dispatch(handleDisconnected());
      addLog('WebSocket disconnected', 'info');
      
      // Navigate to calibration page
      navigate('/calibration');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error during cleanup: ${errorMessage}`, 'error');
      // Still navigate even if there's an error
      navigate('/calibration');
    }
  };

  // Handle redo background
  const handleRedoBackground = async () => {
    addLog('Redoing background selection...', 'info');
    
    try {
      // Stop any ongoing capture
      stopCapture();
      
      // Disconnect WebSocket (will automatically call end_session)
      if (wsService.isConnected()) {
        wsService.disconnect();
        addLog('Session ended', 'success');
      }
      
      // Clear Redux state
      dispatch(clearSavedBackground());
      dispatch(resetSession());
      
      // Reset local state
      setFrameCount(0);
      setFps(0);
      setLogs([]);
      setIsUsingVideo(false);
      
      // Clear video source if it was uploaded
      if (videoRef.current && isUsingVideo) {
        const oldSrc = videoRef.current.src;
        videoRef.current.src = '';
        if (oldSrc.startsWith('blob:')) {
          URL.revokeObjectURL(oldSrc);
        }
      }
      
      addLog('Ready to start new background selection', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Error during reset: ${errorMessage}`, 'error');
      
      // Still reset the state even if there's an error
      dispatch(clearSavedBackground());
      dispatch(resetSession());
      setFrameCount(0);
      setFps(0);
      setLogs([]);
      setIsUsingVideo(false);
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Unknown';
    }
  };

  // If background is saved, show success view
  if (savedBackground) {
    return (
      <div className="background-selection-page">
        <div className="container">
          <h1>Background Saved Successfully</h1>
          
          <div className="saved-background-section">
            <div className="saved-background-preview">
              <h3>Saved Background</h3>
              <img 
                src={savedBackground.image} 
                alt="Saved Background" 
                className="saved-background-image"
              />
              
              <div className="saved-background-info">
                <p><strong>Session ID:</strong> {savedBackground.sessionId}</p>
                <p><strong>Saved At:</strong> {new Date(savedBackground.savedAt).toLocaleString()}</p>
                {savedBackground.metadata && (
                  <>
                    <p><strong>Dimensions:</strong> {savedBackground.metadata.width} × {savedBackground.metadata.height}</p>
                    <p><strong>Frame Count:</strong> {savedBackground.metadata.frameCount}</p>
                  </>
                )}
              </div>
            </div>

            <div className="saved-background-actions">
              <button 
                className="proceed-button"
                onClick={handleProceedToCalibration}
              >
                Proceed to Calibration
              </button>
              
              <button 
                className="redo-button"
                onClick={handleRedoBackground}
              >
                Redo Background Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="background-selection-page">
      <div className="container">
        <h1>Background Selection</h1>
        
        <div className="controls">
          <button 
            onClick={startCapture}
            disabled={isCapturing || connectionStatus !== 'connected' || isUsingVideo}
          >
            Start Camera
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturing || connectionStatus !== 'connected'}
          >
            Upload Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoUpload}
          />
          <button 
            onClick={stopCapture}
            disabled={!isCapturing}
          >
            Stop
          </button>
          <button 
            onClick={handleSaveBackground}
            disabled={!hasBackground || isLoading}
          >
            Save Background
          </button>
          <button 
            onClick={handleUpdateBackground}
            disabled={!isCapturing}
          >
            Update Background
          </button>
        </div>

        <div className={`status ${error ? 'error' : ''}`}>
          <div className="status-item">
            <span className="status-label">Connection:</span>
            <span>{getConnectionStatusText()}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Session ID:</span>
            <span>{sessionId || '-'}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span>{processingStatus}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Frames Processed:</span>
            <span>{frameCount}</span>
          </div>
          <div className="status-item">
            <span className="status-label">FPS:</span>
            <span>{fps}</span>
          </div>
        </div>

        <div className="video-container">
          <div className="video-panel">
            <h3>{isUsingVideo ? 'Uploaded Video' : 'Original Camera'}</h3>
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              loop={isUsingVideo}
            />
          </div>
          <div className="video-panel">
            <h3>Processed Background</h3>
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="logs">
          <strong>Event Log:</strong>
          {logs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.type}`}>
              [{log.timestamp.toLocaleTimeString()}] {log.message}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default BackgroundSelectionPage;