import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
// SEC-001 fix: Share the same JWT secret with auth middleware (single source of truth)
import { JWT_SECRET } from './middleware/auth.js';

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * Authenticates connections using the JWT token from the handshake.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: process.env.NODE_ENV !== 'production'
      ? { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }
      : undefined,
    // Clients send the token as a query param
    path: '/socket.io',
  });

  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.userName} connected (${socket.id})`);

    socket.on('disconnect', () => {
      console.log(`[socket] ${socket.userName} disconnected (${socket.id})`);
    });
  });

  return io;
}

/**
 * Broadcast a data-change event to all connected clients except the one
 * who initiated the change (identified by userId).
 *
 * @param {string} entity  - The entity type that changed (e.g. 'kits', 'trips', 'personnel')
 * @param {string} action  - The action performed ('create', 'update', 'delete', 'checkout', 'return', etc.)
 * @param {object} [meta]  - Optional metadata (e.g. { id, name })
 * @param {string} [excludeUserId] - User ID to exclude from broadcast (the actor)
 */
export function broadcast(entity, action, meta = {}, excludeUserId = null) {
  if (!io) return;

  const payload = { entity, action, ...meta, timestamp: Date.now() };

  if (excludeUserId) {
    // Send to every socket except those belonging to the acting user
    for (const [, socket] of io.sockets.sockets) {
      if (socket.userId !== excludeUserId) {
        socket.emit('data:changed', payload);
      }
    }
  } else {
    io.emit('data:changed', payload);
  }
}

export function getIO() {
  return io;
}
