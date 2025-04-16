import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameInterface from './components/GameInterface';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/lobby/:id" element={<Lobby />} />
        <Route path="/game/:id"  element={<GameInterface />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
