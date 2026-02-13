import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook that manages a Socket.IO connection for real-time updates.
 * Connects when a valid token is present and triggers data refreshes
 * when other users make changes.
 *
 * @param {string|null} token - JWT auth token
 * @param {object} refreshCallbacks - Map of entity names to refresh functions
 *   e.g. { kits: refreshKits, trips: refreshTrips, ... }
 * @param {string|null} currentUserId - The logged-in user's ID (to ignore own broadcasts)
 * @returns {{ connected: boolean, lastEvent: object|null }}
 */
export default function useSocket(token, refreshCallbacks, currentUserId) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const callbacksRef = useRef(refreshCallbacks);

  // Keep callbacks ref up to date without triggering reconnect
  useEffect(() => {
    callbacksRef.current = refreshCallbacks;
  }, [refreshCallbacks]);

  // Debounce refresh calls per entity to avoid flooding the API
  const pendingRef = useRef({});
  const timerRef = useRef({});

  const debouncedRefresh = useCallback((entity) => {
    // Clear any pending timer for this entity
    if (timerRef.current[entity]) {
      clearTimeout(timerRef.current[entity]);
    }

    // Mark as pending
    pendingRef.current[entity] = true;

    // Batch refreshes with a short delay (500ms)
    timerRef.current[entity] = setTimeout(() => {
      if (pendingRef.current[entity] && callbacksRef.current[entity]) {
        callbacksRef.current[entity]();
        pendingRef.current[entity] = false;
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (!token) {
      // Disconnect if token is removed (logout)
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Determine the socket URL based on environment
    // In dev, Vite proxies /socket.io to the backend
    // In production, it's the same origin
    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('data:changed', (payload) => {
      setLastEvent(payload);

      const { entity } = payload;
      if (!entity) return;

      // Refresh the affected entity's data
      debouncedRefresh(entity);

      // Some entities have cascading dependencies
      // e.g. kits changes may affect trips (kit assignment), reservations, etc.
      if (entity === 'kits') {
        debouncedRefresh('reservations');
      }
      if (entity === 'types' || entity === 'components') {
        debouncedRefresh('kits');
      }
      if (entity === 'departments') {
        debouncedRefresh('personnel');
      }
      if (entity === 'settings') {
        debouncedRefresh('settings');
      }
    });

    socket.on('connect_error', (err) => {
      // Silent reconnect — Socket.IO handles retries automatically
      console.debug('[socket] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);

      // Clear all pending timers
      for (const key of Object.keys(timerRef.current)) {
        clearTimeout(timerRef.current[key]);
      }
    };
  }, [token, debouncedRefresh]);

  return { connected, lastEvent };
}
