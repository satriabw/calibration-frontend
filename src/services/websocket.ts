import { io, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export interface WebSocketEvents {
  // Client -> Server events
  start_session: (data: { input_mode: 'camera' | 'file' }) => void;
  process_frame: (data: { frame: string }) => void;
  save_background: (data: {}) => void;
  update_background: (data: { frame: string }) => void;
  end_session: (data: { session_id: string }) => void;
  disconnect: (data: { session_id: string }) => void;
  
  // Server -> Client events
  connected: (data: { message: string }) => void;
  session_started: (data: { success: boolean; session_id: string }) => void;
  frame_processed: (data: {
    success: boolean;
    session_id: string;
    frame_count: number;
    processed_frame: string;
    status: string;
    has_background: boolean;
  }) => void;
  background_saved: (data: { success: boolean; session_id: string; message: string }) => void;
  background_updated: (data: { success: boolean; message: string }) => void;
  error: (data: { message: string }) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private frameInterval: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      this.socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id);
        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.stopFrameCapture();
      });
    });
  }

  disconnect() {
    this.stopFrameCapture();
    if (this.socket?.connected) {
      this.endSession();
      this.socket.disconnect();
    }
    this.socket = null;
  }

  on<K extends keyof WebSocketEvents>(
    event: K,
    callback: (data: any) => void
  ) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }
    this.socket.on(event as string, callback);
  }

  off<K extends keyof WebSocketEvents>(
    event: K,
    callback?: (data: any) => void
  ) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event as string, callback);
    } else {
      this.socket.off(event as string);
    }
  }

  emit<K extends keyof WebSocketEvents>(
    event: K,
    data: any
  ) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      return;
    }
    this.socket.emit(event as string, data);
  }

  startSession(inputMode: 'camera' | 'file') {
    this.emit('start_session', { input_mode: inputMode });
  }

  saveBackground() {
    this.emit('save_background', {});
  }

  updateBackground(frame: string) {
    this.emit('update_background', { frame });
  }

  endSession() {
    this.emit('end_session', { session_id: this.socket?.id });
  }

  startFrameCapture(videoElement: HTMLVideoElement, fps: number = 1) {
    this.stopFrameCapture();
    this.videoElement = videoElement;

    const captureFrame = () => {
      if (!this.videoElement || !this.socket?.connected) {
        this.stopFrameCapture();
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(this.videoElement, 0, 0);

      try {
        const frameData = canvas.toDataURL('image/jpeg', 0.8);
        this.emit('process_frame', { frame: frameData });
      } catch (error) {
        console.error('Error capturing frame:', error);
      }
    };

    // Capture first frame immediately
    captureFrame();

    // Then capture at specified FPS
    this.frameInterval = window.setInterval(captureFrame, 1000 / fps);
  }

  stopFrameCapture() {
    if (this.frameInterval !== null) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    this.videoElement = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
