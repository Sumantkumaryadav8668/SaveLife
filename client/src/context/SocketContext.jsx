import { createContext, useContext, useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { syncOfflineLocations } from '../utils/offlineQueue.js';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, { withCredentials: true, transports: ['websocket'] });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', { role: user.role, userId: user.id, entityId: user.entityId });
      syncOfflineLocations((latitude, longitude, timestamp) => {
        newSocket.emit('update_location', { userId: user.id, latitude, longitude, timestamp });
        return Promise.resolve();
      });
    });

    return () => { newSocket.disconnect(); };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
