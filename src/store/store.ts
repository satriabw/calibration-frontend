import { configureStore } from '@reduxjs/toolkit';
import backgroundSelectionReducer from './backgroundSelectionSlice';

export const store = configureStore({
  reducer: {
    backgroundSelection: backgroundSelectionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;