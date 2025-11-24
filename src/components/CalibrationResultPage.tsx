import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './CalibrationResultPage.css';

interface CalibrationData {
  id: number;
  name: string;
  file_name: string;
  version_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CalibrationResult {
  calibrations: CalibrationData[];
  rms_error: number;
  visualization_image: string;
}

const CalibrationResultPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state as CalibrationResult;

  const handleRecalibrate = () => {
    navigate('/calibration');
  };

  const handleDone = () => {
    navigate('/');
  };

  return (
    <div className="result-page">
      <div className="result-container">
        <div className="left-section">
          <h2>Results</h2>
          <div className="visualization-container">
            <img src={result?.visualization_image} alt="Calibration Result" />
          </div>
          <div className="rms-display">
            RMS: {result?.rms_error?.toFixed(3)} pixels
          </div>
        </div>

        <div className="right-section">
          <h2>Configurations</h2>
          <div className="config-list">
            {result?.calibrations?.map((config) => (
              <div key={config.id} className="config-item">
                <div className="config-version">Version {config.version_id}</div>
                <div className="config-details">
                  <div>{config.name}</div>
                  <div className="config-filename">{config.file_name}</div>
                  <div className={`config-status ${config.status}`}>{config.status}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="action-buttons">
            <button className="btn-recalibrate" onClick={handleRecalibrate}>
              Recalibrate
            </button>
            <button className="btn-done" onClick={handleDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalibrationResultPage;
