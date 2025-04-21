import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameInterface from './components/GameInterface';
import Gallery from './components/Gallery';
import GalleryVoting from './components/GalleryVoting';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/lobby/:id" element={<Lobby />} />
        <Route path="/game/:id"  element={<GameInterface />} />
        <Route path="/gallery/:id" element={<Gallery />} />
        <Route path="/vote/:id" element={<GalleryVoting />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
