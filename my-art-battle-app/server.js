const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('draw-line', ({ roomId, from, to, color, thickness }) => {
    socket.to(roomId).emit('peer-draw', {
      from,
      to,
      color,
      thickness,
      peerId: socket.id
    });
  });

  socket.on('clear-canvas', (roomId) => {
    socket.to(roomId).emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server listening on port 3001');
});