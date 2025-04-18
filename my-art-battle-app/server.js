// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const activeLobbies = {};
const socketToLobby = {}; // Track which lobby each socket is in
const socketToNickname = {}; // Track nickname for each socket
function genLobbyId() {
  // 4‑digit numeric code (1000–9999)
  return String(Math.floor(1000 + Math.random() * 9000));
}

const ROUND_DURATION = 15; // seconds

const WORD_BANK = [
  'apple', 'balloon', 'cat', 'robot', 'flower', 'spaceship', 'treehouse', 'sun',
  'moon', 'castle', 'elephant', 'ice cream truck', 'book', 'paintbrush', 'frog',
  'jellyfish', 'pencil', 'mountain', 'cloud', 'firefox', 'fox', 'donut',
  'pirate ship', 'ghost', 'squirrel', 'bubble tea', 'cake', 'penguin', 'mermaid',
  'giant snail', 'skyscraper', 'hotdog', 'pizza planet', 'witch’s broom', 'giraffe',
  'time machine', 'chair', 'lighthouse', 'bicycle', 'glasses', 'ice dragon',
  'spaceship taco', 'superhero', 'monster', 'vampire', 'zombie', 'treasure map',
  'umbrella', 'star', 'rainbow', 'butterfly', 'bottle', 'moon rabbit', 'robot dog',
  'sandcastle', 'mirror', 'stormy sky', 'glowing fish', 'candy castle', 'sock monster',
  'bee', 'dolphin', 'campfire', 'cactus', 'ball pit', 'tiny planet', 'glowing mushroom',
  'suitcase', 'moon base', 'turtle', 'lava lamp', 'banana', 'orange', 'crayon',
  'dream library', 'floating book', 'giant flower', 'tiny witch', 'tree of eyes',
  'popsicle', 'owl', 'sushi', 'starfish', 'popcorn', 'flying whale', 'tornado',
  'magic mirror', 'volcano', 'cyborg cat', 'robot bakery', 'camera', 'lantern',
  'magic bubble', 'sloth astronaut', 'cloud city', 'storm dragon', 'tiny knight',
  'paint splash', 'firefly swarm', 'neon jellyfish', 'cow', 'spoon', 'globe',
  'backpack', 'skeleton pirate', 'floating tea set', 'paper airplane', 'bunny wizard',
  'magic wand', 'portal door', 'ninja', 'rain boots', 'toothbrush', 'fence',
  'dream cloud', 'bubble snail', 'ferris wheel', 'guitar', 'drum', 'sock dragon',
  'cherry blossom fox', 'lava turtle', 'rocket', 'firetruck', 'peach', 'tree',
  'mirror lake', 'origami crane', 'bean creature', 'flying car', 'crystal cave',
  'glitchy robot', 'kite', 'leaf boat', 'violin', 'pirate', 'steampunk cat',
  'mirror', 'robot painter', 'tiny explorer'
];

const submittedImages = {};

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('create-lobby', (ack) => {
    const lobbyId = genLobbyId();
    activeLobbies[lobbyId] = { players: [socket.id], prompt: null, dominance: 'right' };
    socket.join(lobbyId);
    // Assign default nickname if not set
    if (!socketToNickname[socket.id]) {
      socketToNickname[socket.id] = `Player-${socket.id.slice(0, 4)}`;
    }
    ack(lobbyId);
    // Send an array of { id, nickname } objects
    const playerList = activeLobbies[lobbyId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
    io.to(lobbyId).emit('lobby-update', playerList);
  });

  socket.on('join-lobby', (lobbyId, nickname, ack) => {
    if (!activeLobbies[lobbyId]) return ack(false);
    if (!activeLobbies[lobbyId].players.includes(socket.id)) {
      activeLobbies[lobbyId].players.push(socket.id);
    }
    socket.join(lobbyId);
    // Assign default nickname if blank/undefined
    let finalNickname = nickname && nickname.trim() ? nickname : `Player-${socket.id.slice(0, 4)}`;
    socketToNickname[socket.id] = finalNickname;
    socketToLobby[socket.id] = lobbyId; // <-- Fix: track which lobby this socket is in
    ack(true);
    // Send an array of { id, nickname } objects
    const playerList = activeLobbies[lobbyId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
    io.to(lobbyId).emit('lobby-update', playerList);
    console.log(`User ${socket.id} joined room ${lobbyId}`);
  });

  // Host can kick a player from the lobby
  socket.on('kick-player', (lobbyId, targetId) => {
    const lobby = activeLobbies[lobbyId];
    if (!lobby) return;
    // Only host can kick
    if (lobby.players[0] !== socket.id) return;
    // Don't allow kicking host
    if (targetId === socket.id) return;
    // Remove target from lobby
    lobby.players = lobby.players.filter(id => id !== targetId);
    // Remove nickname
    delete socketToNickname[targetId];
    // Notify the kicked player
    io.to(targetId).emit('kicked');
    // Update lobby for others
    const playerList = lobby.players.map(id => ({ id, nickname: socketToNickname[id] || id }));
    io.to(lobbyId).emit('lobby-update', playerList);
  });

  // New: set handedness for lobby
  socket.on('set-handedness', ({ lobbyId, handedness }, ack) => {
    if (activeLobbies[lobbyId]) {
      activeLobbies[lobbyId].dominance = handedness;
      // Optionally broadcast dominance to lobby
      io.to(lobbyId).emit('lobby-update', {
        players: activeLobbies[lobbyId].players,
        dominance: handedness
      });
    }
    if (ack) ack(); // Always acknowledge to client
  });

  socket.on('join-room', roomId => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('start-game', (lobbyId, roundDuration) => {
    submittedImages[lobbyId] = {};

    const lobby = activeLobbies[lobbyId];
    if (!lobby) return;

    const prompt = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    lobby.prompt = prompt;
    lobby.roundStart = Date.now();
    const duration = typeof roundDuration === 'number' && !isNaN(roundDuration) ? roundDuration : ROUND_DURATION;
    console.log('Server: emitting start-game to lobby', lobbyId, 'with', { roundDuration: duration });
    io.in(lobbyId).emit('start-game', { roundDuration: duration });
    io.in(lobbyId).emit('new-prompt', prompt);

    setTimeout(() => {
      io.in(lobbyId).emit('game-over');
      io.in(lobbyId).emit('clear-canvas');

      setTimeout(() => {
        const images = submittedImages[lobbyId] || {};
        const playerIds = Object.keys(images);
        let winner = null;
        if (playerIds.length > 0) {
          winner = playerIds[Math.floor(Math.random() * playerIds.length)];
        }

        // Send artworks as { playerId: { nickname, image } }
        const artworks = {};
        for (const id of playerIds) {
          artworks[id] = {
            nickname: socketToNickname[id] || id,
            image: images[id]
          };
        }

        io.in(lobbyId).emit('show-gallery', {
          artworks,
          winner,
          hostId: activeLobbies[lobbyId].players[0]   // ← include true host ID
        });
      }, 3000);
    }, duration * 1000);
  });

  socket.on('get-prompt', lobbyId => {
    const lobby = activeLobbies[lobbyId];
    if (lobby && lobby.prompt) {
      socket.emit('new-prompt', lobby.prompt);
    }
  });

  socket.on('get-round-status', (lobbyId, cb) => {
    const lobby = activeLobbies[lobbyId];
    if (lobby && lobby.roundStart) {
      const elapsed = Math.floor((Date.now() - lobby.roundStart) / 1000);
      const timeLeft = Math.max(0, ROUND_DURATION - elapsed);
      cb({ timeLeft });
    } else {
      cb({ timeLeft: null });
    }
  });

  socket.on('submit-image', ({ roomId, image }) => {
    if (!submittedImages[roomId]) {
      submittedImages[roomId] = {};
    }
    submittedImages[roomId][socket.id] = image;
  });

  socket.on('draw-line', ({ roomId, from, to, color, thickness }) => {
    socket.to(roomId).emit('peer-draw', {
      from, to, color, thickness, peerId: socket.id
    });
  });

  socket.on('video-frame', ({ roomId, image }) => {
    console.log('🔄 [server] relaying video-frame from', socket.id, 'to room', roomId);
    socket.to(roomId).emit('peer-video', {
      image,
      peerId: socket.id
    });
  });

  socket.on('clear-canvas', roomId => {
    console.log('Clearing canvas for room', roomId);
    socket.to(roomId).emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const lobbyId = socketToLobby[socket.id];
    if (lobbyId && activeLobbies[lobbyId]) {
      // Remove player from lobby
      const lobby = activeLobbies[lobbyId];
      const wasHost = lobby.players[0] === socket.id;
      lobby.players = lobby.players.filter(id => id !== socket.id);

      // If lobby is empty, delete it
      if (lobby.players.length === 0) {
        delete activeLobbies[lobbyId];
      } else {
        // If host left, promote next player to host
        if (wasHost) {
          // Optionally, notify new host (not required for basic functionality)
          const newHostId = lobby.players[0];
          io.to(newHostId).emit('host-promoted');
        }
        // Update the lobby for remaining players
        const playerList = lobby.players.map(id => ({ id, nickname: socketToNickname[id] || id }));
        io.to(lobbyId).emit('lobby-update', playerList);
      }
    }
    delete socketToLobby[socket.id];
    delete socketToNickname[socket.id];
  });
});

server.listen(3001, () => {
  console.log('Server listening on port 3001');
});
