// src/socket.js
import { io } from 'socket.io-client';
const socket = io('https://dcbg.win', {
  withCredentials: true
});
export default socket;
