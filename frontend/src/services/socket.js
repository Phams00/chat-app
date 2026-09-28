import { io } from 'socket.io-client';

const socketHost = window.location.hostname || 'localhost';
const socket = io(`http://${socketHost}:3000`);

export default socket;