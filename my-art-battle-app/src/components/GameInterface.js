import React, { useState, useEffect } from 'react';
import Canvas from './Canvas';
import axios from 'axios';
import WebcamFeed from './WebcamFeed';

function GameInterface() {
    const [drawingData, setDrawingData] = useState([]);
    const [penState, setPenState] = useState(null);
  
    useEffect(() => {
      // Fetch pen state from backend
      axios.get('/canvas/state')
        .then(res => {
          setPenState(res.data);
        })
        .catch(err => {
          console.error('Error fetching pen state:', err);
        });
    }, []);
  
    // This function will be called when user draws a line
    const handleDrawLine = (line) => {
      setDrawingData(prev => [...prev, line]);
      // In the future, you can also POST this line to your backend
    };
  
    return (
      <div>
        <h1>Art Battle Game</h1>
        <Canvas drawingData={drawingData} onDrawLine={handleDrawLine} />
        <WebcamFeed />
        {penState && (
          <div>
            <p>Pen color: {JSON.stringify(penState.color)}</p>
            <p>Pen thickness: {penState.thickness}</p>
            <p>Can undo: {penState.can_undo ? 'Yes' : 'No'}</p>
            <p>Can redo: {penState.can_redo ? 'Yes' : 'No'}</p>
          </div>
        )}
      </div>
    );
}   

export default GameInterface;