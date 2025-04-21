// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express(); // <-- Initialize app before using it

// CORS setup for frontend (React on localhost:3000)
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

// OAuth/session
const session = require('express-session');
const passport = require('passport');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// Serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth
const GoogleStrategy = require('passport-google-oauth20').Strategy;
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Try to find the user by email
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [profile.emails[0].value]
      );
      let user;
      if (result.rows.length > 0) {
        user = result.rows[0];
      } else {
        // Insert new user if not found
        const insertResult = await pool.query(
          'INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, $3) RETURNING *',
          [profile.displayName, profile.emails[0].value, 'google']
        );
        user = insertResult.rows[0];
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

// Discord OAuth
const DiscordStrategy = require('passport-discord').Strategy;
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: "/auth/discord/callback",
    scope: ['identify', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Try to find the user by Discord ID or email
      let user;
      if (profile.email) {
        const result = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [profile.email]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
      if (!user) {
        // Insert new user if not found
        const insertResult = await pool.query(
          'INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, $3) RETURNING *',
          [profile.username, profile.email || null, 'discord']
        );
        user = insertResult.rows[0];
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

// Start Google OAuth login
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // For popup-based login: notify opener and close window
    res.send(`
      <script>
        window.opener && window.opener.postMessage('oauth-success', 'http://localhost:3000');
        window.close();
      </script>
    `);
  }
);

// Start Discord OAuth login
app.get('/auth/discord',
  passport.authenticate('discord')
);

// Discord OAuth callback
app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    // For popup-based login: notify opener and close window
    res.send(`
      <script>
        window.opener && window.opener.postMessage('oauth-success', 'http://localhost:3000');
        window.close();
      </script>
    `);
  }
);

// Get current user profile (for testing)
app.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Database connection
const pool = require('./db');

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected! Time:', res.rows[0]);
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const activeLobbies = {};
const socketToLobby = {}; // Track which lobby each socket is in
const socketToNickname = {}; // Track nickname for each socket
const likesStore = {};
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

// Store drawing actions per room/player
const drawingStates = {}; // { [roomId]: { [peerId]: [ {from,to,color,thickness} ] } }

const palettes = {}; // { [socketId]: [color1, color2, ...] }
io.on('connection', socket => {
  // Store votes per lobby: { [lobbyId]: { [playerId]: { voterId: score, ... } } }
  const votesByLobby = {};
  console.log('User connected:', socket.id);

  // Palette persistence
  socket.on('update-palette', ({ palette }) => {
    if (palette && Array.isArray(palette) && palette.length === 5) {
      palettes[socket.id] = palette;
    }
  });
  socket.on('request-palette', (ack) => {
    if (typeof ack === 'function') {
      ack(palettes[socket.id] || null);
    }
  });

  socket.on('create-lobby', (ack) => {
    const lobbyId = genLobbyId();
    activeLobbies[lobbyId] = { players: [socket.id], prompt: null, dominance: 'right', private: true };
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

  socket.on('set-lobby-privacy', (lobbyId, isPrivate) => {
    if (activeLobbies[lobbyId] && activeLobbies[lobbyId].players[0] === socket.id) {
      activeLobbies[lobbyId].private = isPrivate;
      // Notify lobby of privacy change if needed
      io.to(lobbyId).emit('lobby-privacy-update', isPrivate);
    }
  });

  socket.on('get-public-lobbies', (ack) => {
    // Only lobbies that are public, not in-game, and not full (optional)
    const publicLobbies = Object.entries(activeLobbies)
      .filter(([id, lobby]) => !lobby.private && !lobby.prompt)
      .map(([id]) => id);
    ack(publicLobbies);
  });

  socket.on('join-random-public-room', (nickname, ack) => {
    const publicLobbies = Object.entries(activeLobbies)
      .filter(([id, lobby]) => !lobby.private && !lobby.prompt)
      .map(([id]) => id);
    if (publicLobbies.length === 0) return ack(false);
    const randomId = publicLobbies[Math.floor(Math.random() * publicLobbies.length)];
    // Directly join the room (do not emit to self)
    if (!activeLobbies[randomId]) return ack(false);
    if (!activeLobbies[randomId].players.includes(socket.id)) {
      activeLobbies[randomId].players.push(socket.id);
    }
    socket.join(randomId);
    let finalNickname = nickname && nickname.trim() ? nickname : `Player-${socket.id.slice(0, 4)}`;
    socketToNickname[socket.id] = finalNickname;
    socketToLobby[socket.id] = randomId;
    ack(randomId);
    // Notify if game is ongoing
    const lobby = activeLobbies[randomId];
    if (lobby && lobby.roundStart && lobby.prompt) {
      io.to(socket.id).emit('game-ongoing');
    }
    // Send updated player list
    const playerList = activeLobbies[randomId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
    io.to(randomId).emit('lobby-update', playerList);
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
    // Notify if game is ongoing
    const lobby = activeLobbies[lobbyId];
    if (lobby && lobby.roundStart && lobby.prompt) {
      io.to(socket.id).emit('game-ongoing');
    }
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

    // FIX: Clear all drawing state for this room so remote canvases start blank
    drawingStates[lobbyId] = {};

    const lobby = activeLobbies[lobbyId];
    if (!lobby) return;

    const prompt = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    lobby.prompt = prompt;
    lobby.roundStart = Date.now();
    const parsedDuration = Number(roundDuration);
    const duration = !isNaN(parsedDuration) && parsedDuration > 0 ? parsedDuration : ROUND_DURATION;
    lobby.roundDuration = duration; // Store the chosen duration on the lobby
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
          hostId: (activeLobbies[lobbyId] && Array.isArray(activeLobbies[lobbyId].players) && activeLobbies[lobbyId].players.length > 0)
            ? activeLobbies[lobbyId].players[0]
            : null // ← include true host ID safely
        });
      }, 3000);
    }, duration * 1000);
  });

  // Also allow manual clearing if needed
  socket.on('clear-canvas', (roomId) => {
    drawingStates[roomId] = {};
    io.in(roomId).emit('clear-canvas');
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
      const duration = (lobby && lobby.roundDuration) ? lobby.roundDuration : ROUND_DURATION;
      const timeLeft = Math.max(0, duration - elapsed);
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
    // Store for sync
    if (!drawingStates[roomId]) drawingStates[roomId] = {};
    if (!drawingStates[roomId][socket.id]) drawingStates[roomId][socket.id] = [];
    drawingStates[roomId][socket.id].push({ from, to, color, thickness });
  });

  // Drawing sync for new/rejoining players
  socket.on('request-drawing-sync', (roomId, ack) => {
    // Send all drawing data for this room
    ack(drawingStates[roomId] || {});
  });

  socket.on('video-frame', ({ roomId, image }) => {
    console.log('🔄 [server] relaying video-frame from', socket.id, 'to room', roomId);
    socket.to(roomId).emit('peer-video', {
      image,
      peerId: socket.id
    });
  });

  // Lobby webcam relay
  socket.on('lobby-video-frame', ({ lobbyId, image }) => {
    // Store the latest frame for this user in this lobby
    if (!activeLobbies[lobbyId]) return;
    if (!activeLobbies[lobbyId].webcamFrames) activeLobbies[lobbyId].webcamFrames = {};
    activeLobbies[lobbyId].webcamFrames[socket.id] = image;
    // Relay to all users in lobby
    socket.to(lobbyId).emit('lobby-peer-video', {
      image,
      peerId: socket.id
    });
  });

  // Multiplayer voting: collect votes from all players
  socket.on('submit-votes', ({ ratings, lobbyId }) => {
    if (!activeLobbies[lobbyId]) return;
    if (!votesByLobby[lobbyId]) votesByLobby[lobbyId] = {};
    // Each voter can only submit once
    Object.entries(ratings).forEach(([playerId, score]) => {
      if (!votesByLobby[lobbyId][playerId]) votesByLobby[lobbyId][playerId] = {};
      votesByLobby[lobbyId][playerId][socket.id] = score;
    });
    // Check if all players have voted (excluding themselves)
    const numPlayers = activeLobbies[lobbyId].players.length;
    // Each player votes for every other player (not themselves)
    const expectedVotesPerPlayer = numPlayers - 1;
    const allVoted = activeLobbies[lobbyId].players.every(pid => {
      // Each player must have submitted votes for all others
      if (pid === socket.id) return true; // skip self
      const votesForPlayer = votesByLobby[lobbyId][pid] || {};
      return Object.keys(votesForPlayer).length >= expectedVotesPerPlayer;
    });
    if (allVoted) {
      // Aggregate: for each player, average their received scores
      const tallies = {};
      let maxAvg = -Infinity, winner = null;
      for (const pid of activeLobbies[lobbyId].players) {
        const votes = votesByLobby[lobbyId][pid] || {};
        const scores = Object.values(votes);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        tallies[pid] = { avg, scores, num: scores.length };
        if (avg > maxAvg) {
          maxAvg = avg;
          winner = pid;
        }
      }
      io.in(lobbyId).emit('voting-results', { winner, tallies });
      // Optionally, clear votes for next round
      delete votesByLobby[lobbyId];
    }
  });

  socket.on('clear-canvas', roomId => {
    console.log('Clearing canvas for room', roomId);
    socket.to(roomId).emit('clear-canvas');
  });

  // Use a Set to store which users (socket.id) have liked each artwork
  socket.on('like-artwork', ({ galleryId, artistId, liked }) => {
    if (!likesStore[galleryId]) likesStore[galleryId] = {};
    if (!likesStore[galleryId][artistId]) likesStore[galleryId][artistId] = new Set();

    if (liked) {
      likesStore[galleryId][artistId].add(socket.id);
    } else {
      likesStore[galleryId][artistId].delete(socket.id);
    }
    const newCount = likesStore[galleryId][artistId].size;
    io.to(artistId).emit('artwork-liked', { artistId, count: newCount });
  });


  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const lobbyId = socketToLobby[socket.id];
    if (lobbyId && activeLobbies[lobbyId]) {
      // Remove player from lobby
      const lobby = activeLobbies[lobbyId];
      const wasHost = lobby.players[0] === socket.id;
      lobby.players = lobby.players.filter(id => id !== socket.id);
      // If lobby is now empty, delete it and clean up
      if (lobby.players.length === 0) {
        delete activeLobbies[lobbyId];
        if (submittedImages[lobbyId]) delete submittedImages[lobbyId];
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
