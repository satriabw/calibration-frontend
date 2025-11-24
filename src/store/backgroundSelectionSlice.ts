import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BackgroundSelectionState {
  inputMode: 'camera' | 'file' | null;
  selectedFileName: string | null;
  sessionId: string | null;
  isSessionActive: boolean;
  currentFrame: { image: string; frameCount: number } | null;
  
  // Saved background for calibration
  savedBackground: {
    image: string; // base64 image data
    sessionId: string;
    savedAt: string; // ISO timestamp
    metadata?: {
      width: number;
      height: number;
      frameCount: number; // camelCase in state
    };
  } | null;
  
  isProcessing: boolean;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  hasStartedProcessing: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  processingStatus: string;
  hasBackground: boolean;
}

const initialState: BackgroundSelectionState = {
  inputMode: null,
  selectedFileName: null,
  sessionId: null,
  isSessionActive: false,
  currentFrame: null,
  savedBackground: null,
  isProcessing: false,
  isLoading: false,
  error: null,
  success: null,
  hasStartedProcessing: false,
  connectionStatus: 'disconnected',
  processingStatus: 'Not started',
  hasBackground: false,
};

const backgroundSelectionSlice = createSlice({
  name: 'backgroundSelection',
  initialState,
  reducers: {
    // UI State Management
    setInputMode: (state, action: PayloadAction<'camera' | 'file' | null>) => {
      state.inputMode = action.payload;
    },
    
    setSelectedFileName: (state, action: PayloadAction<string | null>) => {
      state.selectedFileName = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    clearSuccess: (state) => {
      state.success = null;
    },
    
    // WebSocket Connection Status
    setConnectionStatus: (
      state,
      action: PayloadAction<'disconnected' | 'connecting' | 'connected' | 'error'>
    ) => {
      state.connectionStatus = action.payload;
    },
    
    handleConnected: (state) => {
      state.connectionStatus = 'connected';
      state.error = null;
    },
    
    handleDisconnected: (state) => {
      state.connectionStatus = 'disconnected';
      state.isSessionActive = false;
      state.isProcessing = false;
    },
    
    // WebSocket Event Handlers
    handleSessionStarted: (
      state,
      action: PayloadAction<{ session_id: string }>
    ) => {
      state.sessionId = action.payload.session_id;
      state.isSessionActive = true;
      state.hasStartedProcessing = true;
      state.isLoading = false;
      state.error = null;
      state.processingStatus = 'Session started';
    },
    
    handleFrameProcessed: (
      state,
      action: PayloadAction<{
        processed_frame: string;
        frame_count: number;
        status: string;
        has_background: boolean;
      }>
    ) => {
      state.currentFrame = {
        image: action.payload.processed_frame,
        frameCount: action.payload.frame_count,
      };
      state.isProcessing = true;
      state.processingStatus = action.payload.status;
      state.hasBackground = action.payload.has_background;
      state.error = null;
    },
    
    handleBackgroundSaved: (
      state,
      action: PayloadAction<{
        message: string;
        background_image: string;
        session_id: string;
        metadata?: {
          width: number;
          height: number;
          frame_count: number; // snake_case from backend
        };
      }>
    ) => {
      state.success = action.payload.message;
      state.isLoading = false;
      
      // Store the saved background in state for calibration
      // Convert snake_case to camelCase
      state.savedBackground = {
        image: action.payload.background_image,
        sessionId: action.payload.session_id,
        savedAt: new Date().toISOString(),
        metadata: action.payload.metadata ? {
          width: action.payload.metadata.width,
          height: action.payload.metadata.height,
          frameCount: action.payload.metadata.frame_count, // ✅ Convert to camelCase
        } : undefined,
      };
      
      // ✅ Now state.savedBackground is definitely not null
      console.log('Background saved to Redux state:', {
        sessionId: state.savedBackground.sessionId,
        imageSize: state.savedBackground.image.length,
        savedAt: state.savedBackground.savedAt,
        metadata: state.savedBackground.metadata,
      });
    },
    
    handleBackgroundUpdated: (
      state,
      action: PayloadAction<{ message: string }>
    ) => {
      state.success = action.payload.message;
      state.processingStatus = 'Background updated';
    },
    
    handleWebSocketError: (
      state,
      action: PayloadAction<{ message: string }>
    ) => {
      state.error = action.payload.message;
      state.isLoading = false;
      state.processingStatus = 'Error occurred';
    },
    
    // Session Management
    startSessionRequest: (state) => {
      state.isLoading = true;
      state.error = null;
      state.processingStatus = 'Starting session...';
    },
    
    saveBackgroundRequest: (state) => {
      state.isLoading = true;
      state.error = null;
      state.processingStatus = 'Saving background...';
    },
    
    resetSession: (state) => {
      state.sessionId = null;
      state.isSessionActive = false;
      state.currentFrame = null;
      state.isProcessing = false;
      state.hasStartedProcessing = false;
      state.hasBackground = false;
      state.processingStatus = 'Not started';
      state.error = null;
      state.success = null;
      // Note: We keep savedBackground so it can be used for calibration
    },
    
    clearSavedBackground: (state) => {
      state.savedBackground = null;
      state.success = null;
    },
    
    resetAll: (state) => {
      return initialState;
    },
  },
});

export const {
  setInputMode,
  setSelectedFileName,
  setLoading,
  clearError,
  clearSuccess,
  setConnectionStatus,
  handleConnected,
  handleDisconnected,
  handleSessionStarted,
  handleFrameProcessed,
  handleBackgroundSaved,
  handleBackgroundUpdated,
  handleWebSocketError,
  startSessionRequest,
  saveBackgroundRequest,
  resetSession,
  clearSavedBackground,
  resetAll,
} = backgroundSelectionSlice.actions;

export default backgroundSelectionSlice.reducer;