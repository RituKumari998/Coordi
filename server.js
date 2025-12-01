const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
dotenv.config();
const { Chess } = require('chess.js'); // npm install chess.js
const { ethers } = require('ethers');
const CONTRACT_ABI = [/* ... ABI from user ... */];
const CONTRACT_ADDRESS = '0x9359c146e36771143B8fE180F34037Fb1297a44E';
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Each player: { id: socketId, color: 'white' | 'black' }
const games = {}; // { roomId: { chess: ChessInstance, players: [{id, color}] } }

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    console.log('joining room', roomId);
    if (!games[roomId]) {
      games[roomId] = { chess: new Chess(), players: [] };
    }
    if (games[roomId].players.length < 2) {
      const color = games[roomId].players.length === 0 ? 'white' : 'black';
      games[roomId].players.push({ id: socket.id, color });
      socket.join(roomId);
      socket.emit('init', { fen: games[roomId].chess.fen(), color });
      io.to(roomId).emit('players', games[roomId].players.length);
    }
  });

  socket.on('move', ({ roomId, from, to }) => {
    const game = games[roomId];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    // Only allow the correct color to move
    const turn = game.chess.turn(); // 'w' or 'b'
    if ((turn === 'w' && player.color !== 'white') || (turn === 'b' && player.color !== 'black')) {
      return; // Not this player's turn
    }
    try {
      const move = game.chess.move({ from, to });
      if (move) {
        io.to(roomId).emit('move', { fen: game.chess.fen() });
        if (game.chess.isGameOver()) {
          io.to(roomId).emit('gameover', { result: game.chess.result() });
        }
      }
      // If move is null, it's invalid, just ignore
    } catch (err) {
      console.error('Invalid move attempted:', { from, to }, err.message);
      // Optionally, notify the client: socket.emit('invalid-move', { from, to, message: err.message });
    }
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (games[roomId]) {
        games[roomId].players = games[roomId].players.filter(p => p.id !== socket.id);
        if (games[roomId].players.length === 0) delete games[roomId];
        else io.to(roomId).emit('players', games[roomId].players.length);
      }
    }
  });
});

// --- Smart contract endpoints ---
app.post('/api/end-game', async (req, res) => {
  console.log('end-game', req.body);
  const { roomId, winner } = req.body;
  try {
    const tx = await contract.endGame(roomId, winner);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

server.listen(3001, () => console.log('Server running on port 3001')); 