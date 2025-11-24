import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BackgroundSelectionPage from './components/BackgroundSelectionPage';
import CalibrationPage from './components/CalibrationPage';
import CalibrationResultPage from './components/CalibrationResultPage';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/background" replace />} />
          <Route path="/background" element={<BackgroundSelectionPage />} />
          <Route path="/calibration" element={<CalibrationPage />} />
          <Route path="/calibration-result" element={<CalibrationResultPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;