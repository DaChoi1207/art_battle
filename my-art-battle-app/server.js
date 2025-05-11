// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express(); // <-- Initialize app before using it

// Near the top, after you create your Express app:
app.set('trust proxy', 1);

// CORS setup for frontend (React on localhost:3000)
// const cors = require('cors');
// const allowedOrigins = process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim());
// app.use(cors({
//   origin: allowedOrigins,
//   credentials: true
// }));

const cors = require('cors');
app.use(cors({
  origin: [
    'https://dcbg.win',
    'https://d3jmnopgl2vwc8.cloudfront.net',
    'https://app.dcbg.win',
  ],
  credentials: true
}));

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = process.env.BASE_URL;
const clientOrigin = process.env.CLIENT_ORIGIN;

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// At the top of server.js, after your other imports:
const { Pool } = require('pg');

//PRODUCTION POOL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Needed for AWS RDS by default
  }
});

//DEVELOPMENT POOL
// const pool = new Pool(
//   isProd
//     ? {
//         connectionString: process.env.DATABASE_URL,
//         ssl: { rejectUnauthorized: false }
//       }
//     : {
//         connectionString: process.env.DATABASE_URL
//       }
// );

// Add this route anywhere after your app is defined:
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SESSION MIDDLEWARE SETUP (Postgres) ---
// For local development, use secure: false and sameSite: 'lax'.
// For production, set secure: true and sameSite: 'none' with HTTPS.

const passport = require('passport');

// create one configured middleware instance
const sessionMiddleware = session({
  store: new pgSession({
    pool: pool, // your existing pg Pool instance
    tableName: 'session' // default table name
  }),
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true, // true in production, isProd in development
    sameSite: 'none'
  }
});
// use it for Express
app.use(sessionMiddleware);
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
console.log('Google OAuth callback URL:', `${baseUrl}/auth/google/callback`);
const GoogleStrategy = require('passport-google-oauth20').Strategy;
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${baseUrl}/auth/google/callback`
},
  async (accessToken, refreshToken, profile, done) => {
    console.log('DEBUG: GoogleStrategy verify function called');
    try {
      // Try to find the user by email
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [profile.emails[0].value]
      );
      let user;
      if (result.rows.length > 0) {
        user = result.rows[0];
        // Update auth_provider to 'google' on login
        await pool.query(
          'UPDATE users SET auth_provider = $1 WHERE id = $2',
          ['google', user.id]
        );
        user.auth_provider = 'google';
      } else {
        // Insert new user if not found
        const insertResult = await pool.query(
          'INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, $3) RETURNING *',
          [profile.displayName, profile.emails[0].value, 'google']
        );
        user = insertResult.rows[0];
      }
      console.log('DEBUG: GoogleStrategy user found/created:', user);
      done(null, user);
    } catch (err) {
      console.error('DEBUG: GoogleStrategy error:', err);
      done(err, null);
    }
  }
));

// Discord OAuth
const DiscordStrategy = require('passport-discord').Strategy;
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: `${baseUrl}/auth/discord/callback`,
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
          // Update auth_provider to 'discord' on login
          await pool.query(
            'UPDATE users SET auth_provider = $1 WHERE id = $2',
            ['discord', user.id]
          );
          user.auth_provider = 'discord';
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
app.get('/auth/google', (req, res, next) => {
  console.log('DEBUG: /auth/google route hit');
  next();
},
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback', (req, res, next) => {
  console.log('DEBUG: /auth/google/callback route hit');
  next();
},
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    console.log('DEBUG: Google OAuth callback success, user:', req.user);
    // For popup-based login: notify opener and close window
    res.send(`
      <script>
        window.opener.postMessage('oauth-success', 'https://app.dcbg.win');
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
window.opener.postMessage('oauth-success','https://app.dcbg.win');
        window.close();
      </script>
    `);
  }
);

// Get current user profile
app.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

// Update current user profile
app.post('/profile', express.json(), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { username, profile_pic } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET username = $1, profile_pic = $2 WHERE id = $3 RETURNING *',
      [username, profile_pic, req.user.id]
    );
    // Update the session user object
    req.login(result.rows[0], err => {
      if (err) return res.status(500).json({ error: 'Session update failed' });
      res.json(result.rows[0]);
    });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

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
  cors: {
    origin: 'https://app.dcbg.win', // React dev server
    credentials: true
  }
});

// const io = new Server(server, {
//   cors: {
//     origin: function(origin, callback) {
//       // Allow requests with no origin (like Postman)
//       if (!origin) return callback(null, true);
//       if (allowedOrigins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(new Error('Not allowed by CORS'));
//     },
//     credentials: true
//   }
// });

// and reuse the same instance for Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const activeLobbies = {};
const socketToLobby = {}; // Track which lobby each socket is in
const socketToNickname = {}; // Track nickname for each socket
const likesStore = {};
const socketToDbUser = {};
const votesByLobby = {};
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
  // Debug: print the raw cookie header
  console.log('[SOCKET] Cookie header:', socket.request.headers.cookie);
  // Debug: print the session ID and session object
  console.log('[SOCKET] Session ID:', socket.request.sessionID, 'Session:', socket.request.session);
  // Debug: print the entire session object
  // console.log('[SOCKET CONNECT] session:', socket.request.session);
  // passport/session middleware makes `socket.request.session.passport.user` = your DB id
  const dbUserId = socket.request.session?.passport?.user;
  if (dbUserId) {
    socketToDbUser[socket.id] = dbUserId;
    console.log('[AUTH] Mapping socket to DB user:', socket.id, dbUserId);
  }

  // NEW: Allow client to identify user explicitly after login
  socket.on('identify-user', (dbUserId) => {
    if (dbUserId) {
      socketToDbUser[socket.id] = dbUserId;
      console.log('[IDENTIFY] Set DB user for socket:', socket.id, dbUserId);
    }
  });

  // Store votes per lobby: { [lobbyId]: { [playerId]: { voterId: score, ... } } }
  // const votesByLobby = {};

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
    // Snapshot active players for this round
    const lobby = activeLobbies[lobbyId];
    if (!lobby) return;
    lobby.activePlayers = [...lobby.players];
    // Reset per‑round state
    submittedImages[lobbyId] = {};
    drawingStates[lobbyId] = {};
    // Pick a random prompt and start the round
    const prompt = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    lobby.prompt = prompt;
    lobby.roundStart = Date.now();
    const duration = Number(roundDuration) > 0 ? Number(roundDuration) : ROUND_DURATION;
    lobby.roundDuration = duration;

    io.in(lobbyId).emit('start-game', { roundDuration: duration });
    io.in(lobbyId).emit('new-prompt', prompt);    

    // 1) After drawing time elapses, end the game
    setTimeout(() => {
      io.in(lobbyId).emit('game-over');
      io.in(lobbyId).emit('clear-canvas');

      // 2) Give clients 3s to clear/fade masks, then build gallery
      setTimeout(() => {
        const images = submittedImages[lobbyId] || {};
        const playerIds = Object.keys(images);

        // Decide a winner (highest vote‑avg already computed elsewhere)
        // or random fallback if no votes:
        const winner = playerIds.length
          ? playerIds[Math.floor(Math.random() * playerIds.length)]
          : null;

        // Build the artworks payload
        const artworks = {};
        playerIds.forEach(id => {
          artworks[id] = {
            nickname: socketToNickname[id] || id,
            image: images[id]
          };
        });

        // 3) Finally, send everyone to the gallery
        io.in(lobbyId).emit('show-gallery', {
          artworks,
          winner,
          hostId: lobby.players[0] || null
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
  // replace your existing socket.on('submit-votes', …) with this:
  socket.on('submit-votes', ({ ratings, lobbyId }) => {
    const lobby = activeLobbies[lobbyId];
    if (!lobby) return;
  
    // Initialize storage if not already there
    if (!votesByLobby[lobbyId]) {
      votesByLobby[lobbyId] = {
        ratingsByPlayer: {},
        submitters: new Set()
      };
    }

    const vb = votesByLobby[lobbyId];

    // Only allow activePlayers to submit votes
    if (!lobby.activePlayers || !lobby.activePlayers.includes(socket.id)) {
      // Ignore votes from spectators
      return;
    }
    vb.ratingsByPlayer[socket.id] = ratings;
    vb.submitters.add(socket.id);

    // Only count votes from active players
    const expectedCount = lobby.activePlayers && Array.isArray(lobby.activePlayers)
      ? lobby.activePlayers.length
      : lobby.players.length; // fallback for safety
    const actualCount = vb.submitters.size;

    console.log(`🔎 Votes received: ${actualCount} / ${expectedCount}`);

    if (actualCount < expectedCount) {
      socket.emit('waiting-for-others');
      return;
    }

    // Only tally votes for activePlayers
    const tallies = {};
    for (const pid of lobby.activePlayers || lobby.players) {
      let total = 0;
      let count = 0;
  
      for (const voterId in vb.ratingsByPlayer) {
        const score = vb.ratingsByPlayer[voterId][pid];
        if (score !== undefined) {
          total += score;
          count++;
        }
      }
  
      const avg = count > 0 ? total / count : 0;
      tallies[pid] = avg;
    }
  
    // Pick the winner
    let winner = null;
    let maxAvg = -Infinity;
    for (const [pid, avg] of Object.entries(tallies)) {
      if (avg > maxAvg) {
        maxAvg = avg;
        winner = pid;
      }
    }
  
    // Send results to all
    io.in(lobbyId).emit('voting-results', { winner, tallies });

    // --- STATS UPDATE (SQL) ---
    // Only run this ONCE, after all votes are in and results are sent
    if (votesByLobby[lobbyId]) { // Guard: only update if voting state exists
      lobby.players.forEach(sockId => {
        const dbId = socketToDbUser[sockId];
        if (dbId) {
          pool.query(
            'UPDATE users SET games_played = COALESCE(games_played,0)+1 WHERE id = $1',
            [dbId]
          ).catch(console.error);
        }
      });
      // Debug logging for winner stats update
      console.log('Winner socket ID:', winner);
      console.log('Winner DB user ID:', socketToDbUser[winner]);
      console.log('Lobby players:', lobby.players);
      console.log('DB user IDs:', lobby.players.map(id => socketToDbUser[id]));

      // Increment games_won for the winner (if authenticated)
      const winnerDbId = socketToDbUser[winner];
      if (winnerDbId) {
        pool.query(
          'UPDATE users SET games_won = COALESCE(games_won,0)+1 WHERE id = $1',
          [winnerDbId]
        ).catch(console.error);
      }
      // --- END STATS UPDATE ---
      // Clean up voting state immediately to prevent double-counting
      delete votesByLobby[lobbyId];
    }
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

// Debug: log HTTP session ID, session object, and raw cookie header for every request
app.use((req, res, next) => {
  console.log('[HTTP] Cookie header:', req.headers.cookie);
  console.log('[HTTP] Session ID:', req.sessionID, 'Session:', req.session);
  next();
});

  // --- AI Color Suggestion Endpoint ---
  const { getColorsFromLLM } = require('./utils/aiColors');
  app.post('/api/ai-colors', express.json(), async (req, res) => {
    const { prompt, drawingPrompt, currentPalette } = req.body;
    if (!prompt || !drawingPrompt) return res.status(400).json({ error: 'Missing prompt or drawingPrompt' });
    try {
      const apiKey = process.env.GROQ_API_KEY;
      const colors = await getColorsFromLLM({
        userPrompt: prompt,
        drawingPrompt,
        currentPalette,
        apiKey
      });
      if (!Array.isArray(colors) || colors.length !== 5) {
        return res.status(502).json({ error: 'AI did not return 5 colors', colors });
      }
      res.json({ colors });
    } catch (err) {
      console.error('AI color error:', err);
      res.status(500).json({ error: 'AI color service failed' });
    }
});

// --- API endpoint for updating stats from Gallery page ---
app.post('/api/update-stats', express.json(), async (req, res) => {
  const { userId, won } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    // Only update if user exists
    const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query('UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE id = $1', [userId]);
    if (won) {
      await pool.query('UPDATE users SET games_won = COALESCE(games_won, 0) + 1 WHERE id = $1', [userId]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update stats:', err);
    res.status(500).json({ error: 'Failed to update stats' });
  }
});

// HEALTH CHECK ROUTE (should be here, just before catch-all)
app.get('/', (req, res) => res.sendStatus(200));

// CATCH-ALL HANDLER (should be very last)
app.use((req, res) => {
  res.status(404).send('Not Found');
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Server listening on 0.0.0.0:3001');
});

// // server.js
// require('dotenv').config();
// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express(); // <-- Initialize app before using it

// // Near the top, after you create your Express app:
// app.set('trust proxy', 1);

// // CORS setup for frontend (React on localhost:3000)
// // const cors = require('cors');
// // const allowedOrigins = process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim());
// // app.use(cors({
// //   origin: allowedOrigins,
// //   credentials: true
// // }));

// const cors = require('cors');
// app.use(cors({
//   origin: [
//     'https://dcbg.win',
//     'https://d3jmnopgl2vwc8.cloudfront.net',
//     'https://app.dcbg.win',
//     'http://localhost:3000'
//   ],
//   credentials: true
// }));

// const isProd = process.env.NODE_ENV === 'production';
// const baseUrl = process.env.BASE_URL;
// const clientOrigin = process.env.CLIENT_ORIGIN;

// const session = require('express-session');
// const pgSession = require('connect-pg-simple')(session);

// // At the top of server.js, after your other imports:
// const { Pool } = require('pg');

// //PRODUCTION POOL
// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl: {
// //     rejectUnauthorized: false // Needed for AWS RDS by default
// //   }
// // });

// //DEVELOPMENT POOL
// const pool = new Pool(
//   isProd
//     ? {
//         connectionString: process.env.DATABASE_URL,
//         ssl: { rejectUnauthorized: false }
//       }
//     : {
//         connectionString: process.env.DATABASE_URL
//       }
// );

// // Add this route anywhere after your app is defined:
// app.get('/db-test', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT NOW()');
//     res.json({ success: true, time: result.rows[0].now });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// // --- SESSION MIDDLEWARE SETUP (Postgres) ---
// // For local development, use secure: false and sameSite: 'lax'.
// // For production, set secure: true and sameSite: 'none' with HTTPS.

// const passport = require('passport');

// // create one configured middleware instance
// const sessionMiddleware = session({
//   store: new pgSession({
//     pool: pool, // your existing pg Pool instance
//     tableName: 'session' // default table name
//   }),
//   secret: process.env.SESSION_SECRET || 'keyboard cat',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     httpOnly: true,
//     secure: isProd, // true in production, isProd in development
//     sameSite: isProd ? 'none' : 'lax'
//   }
// });
// // use it for Express
// app.use(sessionMiddleware);
// app.use(passport.initialize());
// app.use(passport.session());

// // Serialization
// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   try {
//     const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
//     done(null, result.rows[0]);
//   } catch (err) {
//     done(err, null);
//   }
// });

// // Google OAuth
// console.log('Google OAuth callback URL:', `${baseUrl}/auth/google/callback`);
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: `${baseUrl}/auth/google/callback`
// },
//   async (accessToken, refreshToken, profile, done) => {
//     console.log('DEBUG: GoogleStrategy verify function called');
//     try {
//       // Try to find the user by email
//       const result = await pool.query(
//         'SELECT * FROM users WHERE email = $1',
//         [profile.emails[0].value]
//       );
//       let user;
//       if (result.rows.length > 0) {
//         user = result.rows[0];
//         // Update auth_provider to 'google' on login
//         await pool.query(
//           'UPDATE users SET auth_provider = $1 WHERE id = $2',
//           ['google', user.id]
//         );
//         user.auth_provider = 'google';
//       } else {
//         // Insert new user if not found
//         const insertResult = await pool.query(
//           'INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, $3) RETURNING *',
//           [profile.displayName, profile.emails[0].value, 'google']
//         );
//         user = insertResult.rows[0];
//       }
//       console.log('DEBUG: GoogleStrategy user found/created:', user);
//       done(null, user);
//     } catch (err) {
//       console.error('DEBUG: GoogleStrategy error:', err);
//       done(err, null);
//     }
//   }
// ));

// // Discord OAuth
// const DiscordStrategy = require('passport-discord').Strategy;
// passport.use(new DiscordStrategy({
//   clientID: process.env.DISCORD_CLIENT_ID,
//   clientSecret: process.env.DISCORD_CLIENT_SECRET,
//   callbackURL: `${baseUrl}/auth/discord/callback`,
//   scope: ['identify', 'email']
// },
//   async (accessToken, refreshToken, profile, done) => {
//     try {
//       // Try to find the user by Discord ID or email
//       let user;
//       if (profile.email) {
//         const result = await pool.query(
//           'SELECT * FROM users WHERE email = $1',
//           [profile.email]
//         );
//         if (result.rows.length > 0) {
//           user = result.rows[0];
//           // Update auth_provider to 'discord' on login
//           await pool.query(
//             'UPDATE users SET auth_provider = $1 WHERE id = $2',
//             ['discord', user.id]
//           );
//           user.auth_provider = 'discord';
//         }
//       }
//       if (!user) {
//         // Insert new user if not found
//         const insertResult = await pool.query(
//           'INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, $3) RETURNING *',
//           [profile.username, profile.email || null, 'discord']
//         );
//         user = insertResult.rows[0];
//       }
//       done(null, user);
//     } catch (err) {
//       done(err, null);
//     }
//   }
// ));

// // Start Google OAuth login
// app.get('/auth/google', (req, res, next) => {
//   console.log('DEBUG: /auth/google route hit');
//   next();
// },
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// // Google OAuth callback
// app.get('/auth/google/callback', (req, res, next) => {
//   console.log('DEBUG: /auth/google/callback route hit');
//   next();
// },
//   passport.authenticate('google', { failureRedirect: '/' }),
//   (req, res) => {
//     console.log('DEBUG: Google OAuth callback success, user:', req.user);
//     // For popup-based login: notify opener and close window
//     res.send(`
//       <script>
//         window.opener.postMessage('oauth-success', 'https://app.dcbg.win');
//         window.close();
//       </script>
//     `);
//   }
// );

// // Start Discord OAuth login
// app.get('/auth/discord',
//   passport.authenticate('discord')
// );

// // Discord OAuth callback
// app.get('/auth/discord/callback',
//   passport.authenticate('discord', { failureRedirect: '/' }),
//   (req, res) => {
//     // For popup-based login: notify opener and close window
//     res.send(`
//       <script>
// window.opener.postMessage('oauth-success','https://app.dcbg.win');
//         window.close();
//       </script>
//     `);
//   }
// );

// // Get current user profile
// app.get('/profile', (req, res) => {
//   if (!req.user) {
//     return res.status(401).json({ error: 'Not authenticated' });
//   }
//   res.json(req.user);
// });

// // Update current user profile
// app.post('/profile', express.json(), async (req, res) => {
//   if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
//   const { username, profile_pic } = req.body;
//   try {
//     const result = await pool.query(
//       'UPDATE users SET username = $1, profile_pic = $2 WHERE id = $3 RETURNING *',
//       [username, profile_pic, req.user.id]
//     );
//     // Update the session user object
//     req.login(result.rows[0], err => {
//       if (err) return res.status(500).json({ error: 'Session update failed' });
//       res.json(result.rows[0]);
//     });
//   } catch (err) {
//     console.error('Failed to update profile:', err);
//     res.status(500).json({ error: 'Failed to update profile' });
//   }
// });

// // Logout
// app.get('/logout', (req, res) => {
//   req.logout(() => {
//     res.redirect('/');
//   });
// });

// // Test the connection
// pool.query('SELECT NOW()', (err, res) => {
//   if (err) {
//     console.error('Database connection error:', err);
//   } else {
//     console.log('Database connected! Time:', res.rows[0]);
//   }
// });

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     //origin: 'https://app.dcbg.win', // React dev server
//     origin: 'http://localhost:3000',
//     credentials: true
//   }
// });

// // const io = new Server(server, {
// //   cors: {
// //     origin: function(origin, callback) {
// //       // Allow requests with no origin (like Postman)
// //       if (!origin) return callback(null, true);
// //       if (allowedOrigins.includes(origin)) {
// //         return callback(null, true);
// //       }
// //       return callback(new Error('Not allowed by CORS'));
// //     },
// //     credentials: true
// //   }
// // });

// // and reuse the same instance for Socket.IO
// io.use((socket, next) => {
//   sessionMiddleware(socket.request, {}, next);
// });

// const activeLobbies = {};
// const socketToLobby = {}; // Track which lobby each socket is in
// const socketToNickname = {}; // Track nickname for each socket
// const likesStore = {};
// const socketToDbUser = {};
// const votesByLobby = {};
// function genLobbyId() {
//   // 4‑digit numeric code (1000–9999)
//   return String(Math.floor(1000 + Math.random() * 9000));
// }

// const ROUND_DURATION = 15; // seconds

// const WORD_BANK = [
//   'apple', 'balloon', 'cat', 'robot', 'flower', 'spaceship', 'treehouse', 'sun',
//   'moon', 'castle', 'elephant', 'ice cream truck', 'book', 'paintbrush', 'frog',
//   'jellyfish', 'pencil', 'mountain', 'cloud', 'firefox', 'fox', 'donut',
//   'pirate ship', 'ghost', 'squirrel', 'bubble tea', 'cake', 'penguin', 'mermaid',
//   'giant snail', 'skyscraper', 'hotdog', 'pizza planet', 'witch’s broom', 'giraffe',
//   'time machine', 'chair', 'lighthouse', 'bicycle', 'glasses', 'ice dragon',
//   'spaceship taco', 'superhero', 'monster', 'vampire', 'zombie', 'treasure map',
//   'umbrella', 'star', 'rainbow', 'butterfly', 'bottle', 'moon rabbit', 'robot dog',
//   'sandcastle', 'mirror', 'stormy sky', 'glowing fish', 'candy castle', 'sock monster',
//   'bee', 'dolphin', 'campfire', 'cactus', 'ball pit', 'tiny planet', 'glowing mushroom',
//   'suitcase', 'moon base', 'turtle', 'lava lamp', 'banana', 'orange', 'crayon',
//   'dream library', 'floating book', 'giant flower', 'tiny witch', 'tree of eyes',
//   'popsicle', 'owl', 'sushi', 'starfish', 'popcorn', 'flying whale', 'tornado',
//   'magic mirror', 'volcano', 'cyborg cat', 'robot bakery', 'camera', 'lantern',
//   'magic bubble', 'sloth astronaut', 'cloud city', 'storm dragon', 'tiny knight',
//   'paint splash', 'firefly swarm', 'neon jellyfish', 'cow', 'spoon', 'globe',
//   'backpack', 'skeleton pirate', 'floating tea set', 'paper airplane', 'bunny wizard',
//   'magic wand', 'portal door', 'ninja', 'rain boots', 'toothbrush', 'fence',
//   'dream cloud', 'bubble snail', 'ferris wheel', 'guitar', 'drum', 'sock dragon',
//   'cherry blossom fox', 'lava turtle', 'rocket', 'firetruck', 'peach', 'tree',
//   'mirror lake', 'origami crane', 'bean creature', 'flying car', 'crystal cave',
//   'glitchy robot', 'kite', 'leaf boat', 'violin', 'pirate', 'steampunk cat',
//   'mirror', 'robot painter', 'tiny explorer'
// ];

// const submittedImages = {};

// // Store drawing actions per room/player
// const drawingStates = {}; // { [roomId]: { [peerId]: [ {from,to,color,thickness} ] } }

// const palettes = {}; // { [socketId]: [color1, color2, ...] }
// io.on('connection', socket => {
//   // Debug: print the raw cookie header
//   console.log('[SOCKET] Cookie header:', socket.request.headers.cookie);
//   // Debug: print the session ID and session object
//   console.log('[SOCKET] Session ID:', socket.request.sessionID, 'Session:', socket.request.session);
//   // Debug: print the entire session object
//   // console.log('[SOCKET CONNECT] session:', socket.request.session);
//   // passport/session middleware makes `socket.request.session.passport.user` = your DB id
//   const dbUserId = socket.request.session?.passport?.user;
//   if (dbUserId) {
//     socketToDbUser[socket.id] = dbUserId;
//     console.log('[AUTH] Mapping socket to DB user:', socket.id, dbUserId);
//   }

//   // NEW: Allow client to identify user explicitly after login
//   socket.on('identify-user', (dbUserId) => {
//     if (dbUserId) {
//       socketToDbUser[socket.id] = dbUserId;
//       console.log('[IDENTIFY] Set DB user for socket:', socket.id, dbUserId);
//     }
//   });

//   // Store votes per lobby: { [lobbyId]: { [playerId]: { voterId: score, ... } } }
//   // const votesByLobby = {};

//   console.log('User connected:', socket.id);

//   // Palette persistence
//   socket.on('update-palette', ({ palette }) => {
//     if (palette && Array.isArray(palette) && palette.length === 5) {
//       palettes[socket.id] = palette;
//     }
//   });
//   socket.on('request-palette', (ack) => {
//     if (typeof ack === 'function') {
//       ack(palettes[socket.id] || null);
//     }
//   });

//   socket.on('create-lobby', (ack) => {
//     const lobbyId = genLobbyId();
//     activeLobbies[lobbyId] = { players: [socket.id], prompt: null, dominance: 'right', private: true };
//     socket.join(lobbyId);
//     // Assign default nickname if not set
//     if (!socketToNickname[socket.id]) {
//       socketToNickname[socket.id] = `Player-${socket.id.slice(0, 4)}`;
//     }
//     ack(lobbyId);
//     // Send an array of { id, nickname } objects
//     const playerList = activeLobbies[lobbyId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
//     io.to(lobbyId).emit('lobby-update', playerList);
//   });

//   socket.on('set-lobby-privacy', (lobbyId, isPrivate) => {
//     if (activeLobbies[lobbyId] && activeLobbies[lobbyId].players[0] === socket.id) {
//       activeLobbies[lobbyId].private = isPrivate;
//       // Notify lobby of privacy change if needed
//       io.to(lobbyId).emit('lobby-privacy-update', isPrivate);
//     }
//   });

//   socket.on('get-public-lobbies', (ack) => {
//     // Only lobbies that are public, not in-game, and not full (optional)
//     const publicLobbies = Object.entries(activeLobbies)
//       .filter(([id, lobby]) => !lobby.private && !lobby.prompt)
//       .map(([id]) => id);
//     ack(publicLobbies);
//   });

//   socket.on('join-random-public-room', (nickname, ack) => {
//     const publicLobbies = Object.entries(activeLobbies)
//       .filter(([id, lobby]) => !lobby.private && !lobby.prompt)
//       .map(([id]) => id);
//     if (publicLobbies.length === 0) return ack(false);
//     const randomId = publicLobbies[Math.floor(Math.random() * publicLobbies.length)];
//     // Directly join the room (do not emit to self)
//     if (!activeLobbies[randomId]) return ack(false);
//     if (!activeLobbies[randomId].players.includes(socket.id)) {
//       activeLobbies[randomId].players.push(socket.id);
//     }
//     socket.join(randomId);
//     let finalNickname = nickname && nickname.trim() ? nickname : `Player-${socket.id.slice(0, 4)}`;
//     socketToNickname[socket.id] = finalNickname;
//     socketToLobby[socket.id] = randomId;
//     ack(randomId);
//     // Notify if game is ongoing
//     const lobby = activeLobbies[randomId];
//     if (lobby && lobby.roundStart && lobby.prompt) {
//       io.to(socket.id).emit('game-ongoing');
//     }
//     // Send updated player list
//     const playerList = activeLobbies[randomId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
//     io.to(randomId).emit('lobby-update', playerList);
//   });

//   socket.on('join-lobby', (lobbyId, nickname, ack) => {
//     if (!activeLobbies[lobbyId]) return ack(false);
//     if (!activeLobbies[lobbyId].players.includes(socket.id)) {
//       activeLobbies[lobbyId].players.push(socket.id);
//     }
//     socket.join(lobbyId);
//     // Assign default nickname if blank/undefined
//     let finalNickname = nickname && nickname.trim() ? nickname : `Player-${socket.id.slice(0, 4)}`;
//     socketToNickname[socket.id] = finalNickname;
//     socketToLobby[socket.id] = lobbyId; // <-- Fix: track which lobby this socket is in
//     ack(true);
//     // Notify if game is ongoing
//     const lobby = activeLobbies[lobbyId];
//     if (lobby && lobby.roundStart && lobby.prompt) {
//       io.to(socket.id).emit('game-ongoing');
//     }
//     // Send an array of { id, nickname } objects
//     const playerList = activeLobbies[lobbyId].players.map(id => ({ id, nickname: socketToNickname[id] || id }));
//     io.to(lobbyId).emit('lobby-update', playerList);
//     console.log(`User ${socket.id} joined room ${lobbyId}`);
//   });

//   // Host can kick a player from the lobby
//   socket.on('kick-player', (lobbyId, targetId) => {
//     const lobby = activeLobbies[lobbyId];
//     if (!lobby) return;
//     // Only host can kick
//     if (lobby.players[0] !== socket.id) return;
//     // Don't allow kicking host
//     if (targetId === socket.id) return;
//     // Remove target from lobby
//     lobby.players = lobby.players.filter(id => id !== targetId);
//     // Remove nickname
//     delete socketToNickname[targetId];
//     // Notify the kicked player
//     io.to(targetId).emit('kicked');
//     // Update lobby for others
//     const playerList = lobby.players.map(id => ({ id, nickname: socketToNickname[id] || id }));
//     io.to(lobbyId).emit('lobby-update', playerList);
//   });

//   // New: set handedness for lobby
//   socket.on('set-handedness', ({ lobbyId, handedness }, ack) => {
//     if (activeLobbies[lobbyId]) {
//       activeLobbies[lobbyId].dominance = handedness;
//       // Optionally broadcast dominance to lobby
//       io.to(lobbyId).emit('lobby-update', {
//         players: activeLobbies[lobbyId].players,
//         dominance: handedness
//       });
//     }
//     if (ack) ack(); // Always acknowledge to client
//   });

//   socket.on('join-room', roomId => {
//     socket.join(roomId);
//     console.log(`User ${socket.id} joined room ${roomId}`);
//   });

//   socket.on('start-game', (lobbyId, roundDuration) => {
//     // Snapshot active players for this round
//     const lobby = activeLobbies[lobbyId];
//     if (!lobby) return;
//     lobby.activePlayers = [...lobby.players];
//     // Reset per‑round state
//     submittedImages[lobbyId] = {};
//     drawingStates[lobbyId] = {};
//     // Pick a random prompt and start the round
//     const prompt = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
//     lobby.prompt = prompt;
//     lobby.roundStart = Date.now();
//     const duration = Number(roundDuration) > 0 ? Number(roundDuration) : ROUND_DURATION;
//     lobby.roundDuration = duration;

//     io.in(lobbyId).emit('start-game', { roundDuration: duration });
//     io.in(lobbyId).emit('new-prompt', prompt);    

//     // 1) After drawing time elapses, end the game
//     setTimeout(() => {
//       io.in(lobbyId).emit('game-over');
//       io.in(lobbyId).emit('clear-canvas');

//       // 2) Give clients 3s to clear/fade masks, then build gallery
//       setTimeout(() => {
//         const images = submittedImages[lobbyId] || {};
//         const playerIds = Object.keys(images);

//         // Decide a winner (highest vote‑avg already computed elsewhere)
//         // or random fallback if no votes:
//         const winner = playerIds.length
//           ? playerIds[Math.floor(Math.random() * playerIds.length)]
//           : null;

//         // Build the artworks payload
//         const artworks = {};
//         playerIds.forEach(id => {
//           artworks[id] = {
//             nickname: socketToNickname[id] || id,
//             image: images[id]
//           };
//         });

//         // 3) Finally, send everyone to the gallery
//         io.in(lobbyId).emit('show-gallery', {
//           artworks,
//           winner,
//           hostId: lobby.players[0] || null
//         });
//       }, 3000);

//     }, duration * 1000);
//   });

//   // Also allow manual clearing if needed
//   socket.on('clear-canvas', (roomId) => {
//     drawingStates[roomId] = {};
//     io.in(roomId).emit('clear-canvas');
//   });

//   socket.on('get-prompt', lobbyId => {
//     const lobby = activeLobbies[lobbyId];
//     if (lobby && lobby.prompt) {
//       socket.emit('new-prompt', lobby.prompt);
//     }
//   });

//   socket.on('get-round-status', (lobbyId, cb) => {
//     const lobby = activeLobbies[lobbyId];
//     if (lobby && lobby.roundStart) {
//       const elapsed = Math.floor((Date.now() - lobby.roundStart) / 1000);
//       const duration = (lobby && lobby.roundDuration) ? lobby.roundDuration : ROUND_DURATION;
//       const timeLeft = Math.max(0, duration - elapsed);
//       cb({ timeLeft });
//     } else {
//       cb({ timeLeft: null });
//     }
//   });

//   socket.on('submit-image', ({ roomId, image }) => {
//     if (!submittedImages[roomId]) {
//       submittedImages[roomId] = {};
//     }
//     submittedImages[roomId][socket.id] = image;
//   });

//   socket.on('draw-line', ({ roomId, from, to, color, thickness }) => {
//     socket.to(roomId).emit('peer-draw', {
//       from, to, color, thickness, peerId: socket.id
//     });
//     // Store for sync
//     if (!drawingStates[roomId]) drawingStates[roomId] = {};
//     if (!drawingStates[roomId][socket.id]) drawingStates[roomId][socket.id] = [];
//     drawingStates[roomId][socket.id].push({ from, to, color, thickness });
//   });

//   // Drawing sync for new/rejoining players
//   socket.on('request-drawing-sync', (roomId, ack) => {
//     // Send all drawing data for this room
//     ack(drawingStates[roomId] || {});
//   });

//   socket.on('video-frame', ({ roomId, image }) => {
//     console.log('🔄 [server] relaying video-frame from', socket.id, 'to room', roomId);
//     socket.to(roomId).emit('peer-video', {
//       image,
//       peerId: socket.id
//     });
//   });

//   // Lobby webcam relay
//   socket.on('lobby-video-frame', ({ lobbyId, image }) => {
//     // Store the latest frame for this user in this lobby
//     if (!activeLobbies[lobbyId]) return;
//     if (!activeLobbies[lobbyId].webcamFrames) activeLobbies[lobbyId].webcamFrames = {};
//     activeLobbies[lobbyId].webcamFrames[socket.id] = image;
//     // Relay to all users in lobby
//     socket.to(lobbyId).emit('lobby-peer-video', {
//       image,
//       peerId: socket.id
//     });
//   });

//   // Multiplayer voting: collect votes from all players
//   // replace your existing socket.on('submit-votes', …) with this:
//   socket.on('submit-votes', ({ ratings, lobbyId }) => {
//     const lobby = activeLobbies[lobbyId];
//     if (!lobby) return;
  
//     // Initialize storage if not already there
//     if (!votesByLobby[lobbyId]) {
//       votesByLobby[lobbyId] = {
//         ratingsByPlayer: {},
//         submitters: new Set()
//       };
//     }

//     const vb = votesByLobby[lobbyId];

//     // Only allow activePlayers to submit votes
//     if (!lobby.activePlayers || !lobby.activePlayers.includes(socket.id)) {
//       // Ignore votes from spectators
//       return;
//     }
//     vb.ratingsByPlayer[socket.id] = ratings;
//     vb.submitters.add(socket.id);

//     // Only count votes from active players
//     const expectedCount = lobby.activePlayers && Array.isArray(lobby.activePlayers)
//       ? lobby.activePlayers.length
//       : lobby.players.length; // fallback for safety
//     const actualCount = vb.submitters.size;

//     console.log(`🔎 Votes received: ${actualCount} / ${expectedCount}`);

//     if (actualCount < expectedCount) {
//       socket.emit('waiting-for-others');
//       return;
//     }

//     // Only tally votes for activePlayers
//     const tallies = {};
//     for (const pid of lobby.activePlayers || lobby.players) {
//       let total = 0;
//       let count = 0;
  
//       for (const voterId in vb.ratingsByPlayer) {
//         const score = vb.ratingsByPlayer[voterId][pid];
//         if (score !== undefined) {
//           total += score;
//           count++;
//         }
//       }
  
//       const avg = count > 0 ? total / count : 0;
//       tallies[pid] = avg;
//     }
  
//     // Pick the winner
//     let winner = null;
//     let maxAvg = -Infinity;
//     for (const [pid, avg] of Object.entries(tallies)) {
//       if (avg > maxAvg) {
//         maxAvg = avg;
//         winner = pid;
//       }
//     }
  
//     // Send results to all
//     io.in(lobbyId).emit('voting-results', { winner, tallies });

//     // --- STATS UPDATE (SQL) ---
//     // Only run this ONCE, after all votes are in and results are sent
//     if (votesByLobby[lobbyId]) { // Guard: only update if voting state exists
//       lobby.players.forEach(sockId => {
//         const dbId = socketToDbUser[sockId];
//         if (dbId) {
//           pool.query(
//             'UPDATE users SET games_played = COALESCE(games_played,0)+1 WHERE id = $1',
//             [dbId]
//           ).catch(console.error);
//         }
//       });
//       // Debug logging for winner stats update
//       console.log('Winner socket ID:', winner);
//       console.log('Winner DB user ID:', socketToDbUser[winner]);
//       console.log('Lobby players:', lobby.players);
//       console.log('DB user IDs:', lobby.players.map(id => socketToDbUser[id]));

//       // Increment games_won for the winner (if authenticated)
//       const winnerDbId = socketToDbUser[winner];
//       if (winnerDbId) {
//         pool.query(
//           'UPDATE users SET games_won = COALESCE(games_won,0)+1 WHERE id = $1',
//           [winnerDbId]
//         ).catch(console.error);
//       }
//       // --- END STATS UPDATE ---
//       // Clean up voting state immediately to prevent double-counting
//       delete votesByLobby[lobbyId];
//     }
//   });
  

//   socket.on('disconnect', () => {
//     console.log('User disconnected:', socket.id);
//     const lobbyId = socketToLobby[socket.id];
//     if (lobbyId && activeLobbies[lobbyId]) {
//       // Remove player from lobby
//       const lobby = activeLobbies[lobbyId];
//       const wasHost = lobby.players[0] === socket.id;
//       lobby.players = lobby.players.filter(id => id !== socket.id);
//       // If lobby is now empty, delete it and clean up
//       if (lobby.players.length === 0) {
//         delete activeLobbies[lobbyId];
//         if (submittedImages[lobbyId]) delete submittedImages[lobbyId];
//       } else {
//         // If host left, promote next player to host
//         if (wasHost) {
//           // Optionally, notify new host (not required for basic functionality)
//           const newHostId = lobby.players[0];
//           io.to(newHostId).emit('host-promoted');
//         }
//         // Update the lobby for remaining players
//         const playerList = lobby.players.map(id => ({ id, nickname: socketToNickname[id] || id }));
//         io.to(lobbyId).emit('lobby-update', playerList);
//       }
//     }
//     delete socketToLobby[socket.id];
//     delete socketToNickname[socket.id];
//   });
// });

// // Debug: log HTTP session ID, session object, and raw cookie header for every request
// app.use((req, res, next) => {
//   console.log('[HTTP] Cookie header:', req.headers.cookie);
//   console.log('[HTTP] Session ID:', req.sessionID, 'Session:', req.session);
//   next();
// });

// // --- AI Color Suggestion Endpoint ---
// const { getColorsFromLLM } = require('./utils/aiColors');
// app.post('/api/ai-colors', express.json(), async (req, res) => {
//   const { prompt, drawingPrompt, currentPalette } = req.body;
//   if (!prompt || !drawingPrompt) return res.status(400).json({ error: 'Missing prompt or drawingPrompt' });
//   try {
//     const apiKey = process.env.GROQ_API_KEY;
//     const colors = await getColorsFromLLM({
//       userPrompt: prompt,
//       drawingPrompt,
//       currentPalette,
//       apiKey
//     });
//     if (!Array.isArray(colors) || colors.length !== 5) {
//       return res.status(502).json({ error: 'AI did not return 5 colors', colors });
//     }
//     res.json({ colors });
//   } catch (err) {
//     console.error('AI color error:', err);
//     res.status(500).json({ error: 'AI color service failed' });
//   }
// });

// // --- API endpoint for updating stats from Gallery page ---
// app.post('/api/update-stats', express.json(), async (req, res) => {
//   const { userId, won } = req.body;
//   if (!userId) return res.status(400).json({ error: 'Missing userId' });
//   try {
//     // Only update if user exists
//     const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
//     if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
//     await pool.query('UPDATE users SET games_played = COALESCE(games_played, 0) + 1 WHERE id = $1', [userId]);
//     if (won) {
//       await pool.query('UPDATE users SET games_won = COALESCE(games_won, 0) + 1 WHERE id = $1', [userId]);
//     }
//     res.json({ success: true });
//   } catch (err) {
//     console.error('Failed to update stats:', err);
//     res.status(500).json({ error: 'Failed to update stats' });
//   }
// });

// // HEALTH CHECK ROUTE (should be here, just before catch-all)
// app.get('/', (req, res) => res.sendStatus(200));

// // CATCH-ALL HANDLER (should be very last)
// app.use((req, res) => {
//   res.status(404).send('Not Found');
// });

// server.listen(3001, '0.0.0.0', () => {
//   console.log('Server listening on 0.0.0.0:3001');
// });