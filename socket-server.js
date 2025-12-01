const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');

const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io',
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Store connected players and their game codes
const gameRooms = new Map();
const playerSockets = new Map(); // Map player address to socket ID

io.on('connection', (socket) => {
  console.log('Client connected:', { socketId: socket.id });

  // Host creates a new room
  socket.on('create-room', ({ playerAddress, gameCode, timestamp }, callback) => {
    if (gameRooms.has(gameCode)) {
      if (callback) callback({ success: false, error: 'Room already exists' });
      return;
    }
    gameRooms.set(gameCode, new Set([playerAddress]));
    playerSockets.set(playerAddress, socket.id);
    socket.join(gameCode);
    console.log('Room created:', gameCode, 'by', playerAddress);
    if (callback) callback({ success: true, gameCode });
    io.to(gameCode).emit('room-state', {
      gameCode,
      players: Array.from(gameRooms.get(gameCode)),
      timestamp: new Date().toISOString()
    });
    if (gameRooms.get(gameCode).size === 2) {
      io.to(gameCode).emit('both-connected', {
        gameCode,
        players: Array.from(gameRooms.get(gameCode)),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Any player joins an existing room
  socket.on('join-room', ({ playerAddress, gameCode, timestamp }, callback) => {
    if (!gameRooms.has(gameCode)) {
      if (callback) callback({ success: false, error: 'Room does not exist' });
      return;
    }
    gameRooms.get(gameCode).add(playerAddress);
    playerSockets.set(playerAddress, socket.id);
    socket.join(gameCode);
    console.log('Player joined room:', gameCode, playerAddress);
    if (callback) callback({ success: true, gameCode });
    io.to(gameCode).emit('room-state', {
      gameCode,
      players: Array.from(gameRooms.get(gameCode)),
      timestamp: new Date().toISOString()
    });
    if (gameRooms.get(gameCode).size === 2) {
      io.to(gameCode).emit('both-connected', {
        gameCode,
        players: Array.from(gameRooms.get(gameCode)),
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('player-connected', ({ gameCode, playerAddress, isHost, timestamp }) => {
    console.log('Player connected to room:', {
      socketId: socket.id,
      gameCode,
      playerAddress,
      isHost,
      timestamp
    });
    socket.to(gameCode).emit('opponent-connected', {
      playerAddress,
      isHost,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('make-move', ({ gameCode, position, playerAddress }) => {
    console.log('Move made:', {
      socketId: socket.id,
      gameCode,
      position,
      playerAddress,
      timestamp: new Date().toISOString()
    });
    socket.to(gameCode).emit('move-made', {
      position,
      playerAddress,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', {
      socketId: socket.id,
      reason,
      timestamp: new Date().toISOString()
    });
    let playerAddress;
    for (const [addr, sid] of Array.from(playerSockets.entries())) {
      if (sid === socket.id) {
        playerAddress = addr;
        break;
      }
    }
    if (playerAddress) {
      gameRooms.forEach((players, code) => {
        if (players.has(playerAddress)) {
          players.delete(playerAddress);
          console.log('Player removed from room:', {
            gameCode: code,
            playerAddress,
            remainingPlayers: Array.from(players)
          });
          io.to(code).emit('player-disconnected', {
            playerAddress,
            timestamp: new Date().toISOString()
          });
          if (players.size === 0) {
            gameRooms.delete(code);
            console.log('Game room deleted:', code);
          }
        }
      });
      playerSockets.delete(playerAddress);
    }
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running at http://localhost:${PORT}`);
}); 