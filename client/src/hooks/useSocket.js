import { useContext } from 'react';
import SocketContext from '../context/SocketContext.jsx';

/** Hook to access the socket.io instance */
export const useSocket = () => useContext(SocketContext);
