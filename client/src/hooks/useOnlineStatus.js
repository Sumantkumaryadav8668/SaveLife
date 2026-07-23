import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth.js';
import { useSocket } from './useSocket.js';
import { syncOfflineLocations } from '../utils/offlineQueue.js';

/** Tracks online/offline status and syncs queued GPS when reconnecting */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();
  const socket = useSocket();

  const syncOnReconnect = useCallback(() => {
    if (user && socket) {
      syncOfflineLocations((latitude, longitude, timestamp) => {
        socket.emit('update_location', { userId: user.id, latitude, longitude, timestamp });
        return Promise.resolve();
      });
    }
  }, [user, socket]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncOnReconnect(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOnReconnect]);

  return isOnline;
};
