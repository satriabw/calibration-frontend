import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store/store';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './CalibrationPage.css';

interface Point {
  x: number;
  y: number;
  order: number;
}

interface Coordinate {
  lat: number;
  lng: number;
  order: number;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom numbered icon
const createNumberedIcon = (number: number) => {
  return L.divIcon({
    html: `<div class="numbered-marker">${number}</div>`,
    className: 'custom-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Origin icon
const originIcon = L.divIcon({
  html: '<div class="origin-marker">O</div>',
  className: 'custom-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const MapClickHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const CalibrationPage: React.FC = () => {
  const navigate = useNavigate();
  const savedBackground = useSelector(
    (state: RootState) => state.backgroundSelection.savedBackground
  );

  const [imagePoints, setImagePoints] = useState<Point[]>([]);
  const [mapCoordinates, setMapCoordinates] = useState<Coordinate[]>([]);
  const [originCoordinate, setOriginCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [selectingOrigin, setSelectingOrigin] = useState(false);
  
  const imageRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgElementRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Get the displayed size and natural size of the image
    const displayedWidth = imgElementRef.current.width;
    const displayedHeight = imgElementRef.current.height;
    const naturalWidth = imgElementRef.current.naturalWidth;
    const naturalHeight = imgElementRef.current.naturalHeight;
    
    // Calculate the actual pixel coordinates on the original image
    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;
    
    const actualX = clickX * scaleX;
    const actualY = clickY * scaleY;
    
    const newPoint: Point = {
      x: actualX,
      y: actualY,
      order: imagePoints.length + 1,
    };
    
    setImagePoints([...imagePoints, newPoint]);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (selectingOrigin) {
      setOriginCoordinate({ lat, lng });
      setSelectingOrigin(false);
      return;
    }

    const newCoord: Coordinate = {
      lat,
      lng,
      order: mapCoordinates.length + 1,
    };
    
    setMapCoordinates([...mapCoordinates, newCoord]);
  };

  const handleReset = () => {
    setImagePoints([]);
    setMapCoordinates([]);
    setOriginCoordinate(null);
    setSelectingOrigin(false);
  };

  const handleCalibrate = async () => {
    const payload = {
      pixels: imagePoints.map(p => [p.x, p.y]),
      coordinates: mapCoordinates.map(c => [c.lat, c.lng]),
      origin: originCoordinate ? [originCoordinate.lat, originCoordinate.lng] : null,
      name: 'test_calibration',
      image: savedBackground?.image || '',
    };

    const response = await fetch('http://localhost:8000/api/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    navigate('/calibration-result', { state: result });
  };

  const handleSelectOrigin = () => {
    setSelectingOrigin(true);
    alert('Click on the map to select origin coordinate');
  };

  if (!savedBackground) {
    return (
      <div className="calibration-page">
        <div className="container">
          <h1>Error: No Background</h1>
          <p>Please select a background first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calibration-page">
      <div className="calibration-container">
        <div className="left-panel">
          <h2>Background</h2>
          <div 
            ref={imageRef}
            className="image-container"
            onClick={handleImageClick}
          >
            <img 
              ref={imgElementRef}
              src={savedBackground.image} 
              alt="Background"
              draggable={false}
            />
            {imagePoints.map((point) => {
              // Calculate display position from actual image coordinates
              if (!imgElementRef.current) return null;
              
              const displayedWidth = imgElementRef.current.width;
              const displayedHeight = imgElementRef.current.height;
              const naturalWidth = imgElementRef.current.naturalWidth;
              const naturalHeight = imgElementRef.current.naturalHeight;
              
              const scaleX = displayedWidth / naturalWidth;
              const scaleY = displayedHeight / naturalHeight;
              
              const displayX = point.x * scaleX;
              const displayY = point.y * scaleY;
              
              return (
                <div
                  key={point.order}
                  className="point-marker"
                  style={{
                    left: `${displayX}px`,
                    top: `${displayY}px`,
                  }}
                >
                  {point.order}
                </div>
              );
            })}
          </div>
          <div className="controls">
            <button onClick={() => setImagePoints([])}>Reset</button>
          </div>
        </div>

        <div className="right-panel">
          <h2>Maps</h2>
          <MapContainer
            center={[36.866380, -119.779463]}
            zoom={15}
            className="map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handleMapClick} />
            
            {mapCoordinates.map((coord) => (
              <Marker
                key={coord.order}
                position={[coord.lat, coord.lng]}
                icon={createNumberedIcon(coord.order)}
              />
            ))}
            
            {originCoordinate && (
              <Marker
                position={[originCoordinate.lat, originCoordinate.lng]}
                icon={originIcon}
              />
            )}
          </MapContainer>
          <div className="controls">
            <button onClick={() => setMapCoordinates([])}>Reset</button>
            <button onClick={handleSelectOrigin}>Select Origin</button>
            <button onClick={handleCalibrate}>Calibrate</button>
          </div>
        </div>
      </div>

      <div className="info-panel">
        <div>
          <strong>Image Points:</strong> {imagePoints.length}
          <div className="point-list">
            {imagePoints.map(p => (
              <span key={p.order}>#{p.order}: ({p.x.toFixed(0)}, {p.y.toFixed(0)}) </span>
            ))}
          </div>
        </div>
        <div>
          <strong>Map Coordinates:</strong> {mapCoordinates.length}
          <div className="point-list">
            {mapCoordinates.map(c => (
              <span key={c.order}>#{c.order}: ({c.lat.toFixed(6)}, {c.lng.toFixed(6)}) </span>
            ))}
          </div>
        </div>
        {originCoordinate && (
          <div>
            <strong>Origin:</strong> ({originCoordinate.lat.toFixed(6)}, {originCoordinate.lng.toFixed(6)})
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationPage;