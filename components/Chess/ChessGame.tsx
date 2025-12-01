import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { Chessboard } from 'react-chessboard';
import Chess3D from './Chess3D';
import { useFrame } from '@/components/farcaster-provider';
import { farcasterFrame } from '@farcaster/frame-wagmi-connector';
import { parseUnits, encodeFunctionData, erc20Abi } from 'viem';
import { APP_URL } from '@/lib/constants';
import { base, monadTestnet } from 'viem/chains';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useSendTransaction,
  useContractRead,
  useReadContract,
} from 'wagmi';
import CONTRACT_ABI from '../../contract/abi.json';
import { StickyNav } from './StickyNav';
import { WalletPage } from './WalletPage';
import { waitForTransaction, waitForTransactionReceipt } from 'wagmi/actions';
import { config } from '../wallet-provider';

const CONTRACT_ADDRESS = '0x037bAAc46Be0BFcC93D2c5Ee10A43bE1Bc09d6FB';
const socket = io('http://localhost:3001');

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Replace with actual USDC address

type InitPayload = { fen: string; color: 'white' | 'black' };
type MovePayload = { fen: string };
type GameoverPayload = { result: string };
type DropHandler = (sourceSquare: string, targetSquare: string) => boolean;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getTurnFromFen(fen: string): 'white' | 'black' {
  // FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
  // The 2nd part is 'w' or 'b'
  const parts = fen.split(' ');
  return parts[1] === 'w' ? 'white' : 'black';
}

function getGameStatus(result: string) {
  if (result === '1-0') return { message: 'White wins!', color: 'text-green-600' };
  if (result === '0-1') return { message: 'Black wins!', color: 'text-green-600' };
  if (result === '1/2-1/2') return { message: 'Draw!', color: 'text-yellow-600' };
  return { message: 'Game Over', color: 'text-gray-600' };
}

// Add this function to call the backend API for end-game payout
async function endGameOnChain(roomId: string, winner: string) {
  try {
    const res = await fetch('http://localhost:3001/api/end-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, winner }),
    });
    const data = await res.json();
    if (data.success) {
      alert('Payout transaction sent! Tx: ' + data.txHash);
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err: any) {
    alert('Network error: ' + err.message);
  }
}

// Call backend to create a game room (pool)
async function createGameOnChain(roomId: string, betAmount: string) {
  try {
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, betAmount }),
    });
    const data = await res.json();
    if (data.success) {
      alert('Game created! Tx: ' + data.txHash);
      return true;
    } else {
      alert('Error: ' + data.error);
      return false;
    }
  } catch (err: any) {
    alert('Network error: ' + err.message);
    return false;
  }
}

// Call backend to join a game room (pool)
async function joinGameOnChain(roomId: string, betAmount: string) {
  try {
    const res = await fetch('/api/join-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, betAmount }),
    });
    const data = await res.json();
    if (data.success) {
      alert('Joined game! Tx: ' + data.txHash);
      return true;
    } else {
      alert('Error: ' + data.error);
      return false;
    }
  } catch (err: any) {

    alert('Network error: ' + err.message);
    return false;
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function ChessGame({ setSelectedGame }: { setSelectedGame: (v: string | null) => void }) {
  const { context, actions } = useFrame();
  const [fen, setFen] = useState<string>('start');
  const [color, setColor] = useState<'white' | 'black'>('white');
  
  const [players, setPlayers] = useState<number>(0);
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoom, setInputRoom] = useState<string>('');
  const [inGame, setInGame] = useState<boolean>(false);
  const [mode, setMode] = useState<'choose' | 'join' | 'create'>('choose');
  const [gameResult, setGameResult] = useState<string>('');
  const { isConnected, address, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { isEthProviderAvailable } = useFrame();
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [use3D, setUse3D] = useState<boolean>(true);
  const [betAmount, setBetAmount] = useState<string>('');
  const { sendTransaction, sendTransactionAsync, isPending, data } = useSendTransaction();
  const [showBetInput, setShowBetInput] = useState(false);
  const [showJoinBetInput, setShowJoinBetInput] = useState(false);
  const [createRoomId, setCreateRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinBetAmount, setJoinBetAmount] = useState('');
  const [createStep, setCreateStep] = useState<'idle' | 'roomGenerated' | 'pendingTx' | 'inGame'>('idle');
  
  const [playerAddresses, setPlayerAddresses] = useState<{ white?: string; black?: string }>({});
  const [showWallet, setShowWallet] = useState(false);
  const [opponentContext, setOpponentContext] = useState<any>(null);

  const {
    data: roomInfoData,
    isLoading: isRoomInfoLoading,
    error: roomInfoError,
    refetch: refetchRoomInfo,
  } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getRoomInfo',
    args: [joinRoomId],
  });

  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ amount: string, roomId: string } | null>(null);
  const [joinApprovalTxHash, setJoinApprovalTxHash] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<{ amount: string, roomId: string } | null>(null);

  // Move handleGameover out of useEffect
  const handleGameover = async ({ result }: GameoverPayload) => {
    setGameResult(result);
    const status = getGameStatus(result);
    let winnerAddress = '';
    let winnerColor: 'white' | 'black' | null = null;
    if (result === '1-0') {
      winnerAddress = playerAddresses.white || '';
      winnerColor = 'white';
    } else if (result === '0-1') {
      winnerAddress = playerAddresses.black || '';
      winnerColor = 'black';
    }
    // Only the winner's client triggers the cast
    if (winnerAddress && address?.toLowerCase() === winnerAddress.toLowerCase()) {
      // await endGameOnChain(roomId, winnerAddress);
      // Compose Farcaster cast if possible
      if (actions && context?.user) {
        // Winner info
        const winnerName = context.user.displayName || context.user.username || 'Winner';
        const winnerUsername = context.user.username || '';
        // Loser info (from opponentContext)
        let loserName = 'Opponent';
        let loserUsername = '';
        if (opponentContext?.displayName || opponentContext?.username) {
          loserName = opponentContext.displayName || opponentContext.username;
          loserUsername = opponentContext.username || '';
        }
        // Fallback: if opponentContext is not set, use color logic
        if (!opponentContext && context.user) {
          if (winnerColor === 'white' && color === 'white') {
            loserName = 'Black Player';
          } else if (winnerColor === 'black' && color === 'black') {
            loserName = 'White Player';
          }
        }
        const castText = `🏆 ${winnerName} (@${winnerUsername}) won against ${loserUsername ? ` (@${loserUsername})` : ''} in TurnOnMonad!`;
        try {
          await actions.composeCast({
            text: castText,
            embeds: [`${APP_URL}`],
          });
        } catch (err) {
          // Optionally handle error
        }
      }
    }
    setTimeout(() => {
      if (confirm(`${status.message} Would you like to play again?`)) {
        setInGame(false);
        setMode('choose');
        setGameResult('');
        setRoomId('');
        setFen('start');
        setPlayers(0);
      }
    }, 500);
  };

  useEffect(() => {
    if (!inGame || !roomId) return;

    const handleInit = ({ fen, color }: InitPayload) => { 
      setFen(fen); 
      setColor(color); 
      // Track player address for this color
      setPlayerAddresses(prev => ({ ...prev, [color]: address }));
      // Try to set opponent context if available from socket.io (not implemented here)
    };

    const handleMove = ({ fen }: MovePayload) => {
      setFen(fen);
      setLastMove(null); // Reset last move highlight
    };

    // Remove handleGameover from here

    const handlePlayers = (count: number) => {
      setPlayers(count);
    };

    socket.on('init', handleInit);
    socket.on('move', handleMove);
    socket.on('gameover', handleGameover);
    socket.on('players', handlePlayers);

    return () => {
      socket.off('init', handleInit);
      socket.off('move', handleMove);
      socket.off('gameover', handleGameover);
      socket.off('players', handlePlayers);
    };
  }, [inGame, roomId, address]);

  const onDrop: DropHandler = (sourceSquare, targetSquare) => {
    socket.emit('move', { roomId, from: sourceSquare, to: targetSquare });
    return true;
  };

  // Handle 3D chess square clicks
  const handleSquareClick = (square: string) => {
    if (!isMyTurn) return;
    
    if (selectedSquare === null) {
      // First click - select piece
      setSelectedSquare(square);
    } else if (selectedSquare === square) {
      // Click same square - deselect
      setSelectedSquare(null);
    } else {
      // Second click - try to move
      socket.emit('move', { roomId, from: selectedSquare, to: square });
      setSelectedSquare(null);
    }
  };

  // Handlers using sendTransaction and encodeFunctionData
  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    setCreateRoomId(newRoomId);
    setShowBetInput(true);
    setShowJoinBetInput(false);
    setCreateStep('roomGenerated');
  };

  const handlePlaceBetAndCreateGame = async () => {
    if (!isConnected) {
      connect({ connector: farcasterFrame() });
      return;
    }
    if (chainId !== base.id) {
      switchChain({ chainId: base.id });
      return;
    }
    let amount = betAmount;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Invalid bet amount.');
      return;
    }
    setCreateStep('pendingTx');
    setPendingCreate({ amount, roomId: createRoomId });
    sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, parseUnits(amount, 6)] })
    });
  };

  const handleJoinRoom = async () => {
    if (!isConnected) {
      connect({ connector: farcasterFrame() });
      return;
    }
    if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id });
      return;
    }
    let amount = joinBetAmount;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Invalid bet amount.');
      return;
    }
    setPendingJoin({ amount, roomId: joinRoomId });
    sendTransaction({
      to: USDC_ADDRESS,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, parseUnits(amount, 6)] })
    });
  };

  // Watch for approval hash for create
  useEffect(() => {
    if (pendingCreate && data) {
      setApprovalTxHash(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pendingCreate]);

  // After approval, wait for confirmation and call createGame
  useEffect(() => {
    if (approvalTxHash && pendingCreate) {
      (async () => {
        await waitForTransactionReceipt({ hash: approvalTxHash, chainId }, config);
        const data2 = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: 'createGame',
          args: [parseUnits(pendingCreate.amount, 6)],
        });
        await sendTransaction({
          to: CONTRACT_ADDRESS as `0x${string}`,
          data: data2,
        });
        setCreateStep('inGame');
        setInGame(true);
        setRoomId(pendingCreate.roomId);
        socket.emit('join', pendingCreate.roomId);
        setApprovalTxHash(null);
        setPendingCreate(null);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalTxHash, pendingCreate]);

  // Watch for approval hash for join
  useEffect(() => {
    if (pendingJoin && data) {
      setJoinApprovalTxHash(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pendingJoin]);

  // After approval, wait for confirmation and call joinGame
  useEffect(() => {
    if (joinApprovalTxHash && pendingJoin) {
      (async () => {
        await waitForTransactionReceipt({ hash: joinApprovalTxHash, chainId }, config);
        const data2 = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: 'joinGame',
          args: [pendingJoin.roomId],
        });
        await sendTransaction({
          to: CONTRACT_ADDRESS as `0x${string}`,
          data: data2,
        });
        setInGame(true);
        setRoomId(pendingJoin.roomId);
        socket.emit('join', pendingJoin.roomId);
        setJoinApprovalTxHash(null);
        setPendingJoin(null);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinApprovalTxHash, pendingJoin]);

  // Determine whose turn it is
  const turn = getTurnFromFen(fen);
  const isMyTurn = players === 2 && turn === color;

  if (!inGame) {
    if (mode === 'choose') {
      return (
        
        <div className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-xl border border-gray-200 space-y-6">
             <button
            onClick={() => {
              setSelectedGame(null)
            }}
            className="mb-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg shadow transition-all duration-200"
          >
            ← Back to Home
          </button>
          <div className="flex items-center space-x-3 mb-4">
          <StickyNav onWalletClick={() => setShowWallet(true)} />
          {showWallet && <WalletPage onClose={() => setShowWallet(false)} />}
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">♛</span>
            </div>
           
            <h2 className="text-2xl font-bold text-gray-800">TurnOnMonad</h2>
          </div>
          <p className="text-center text-gray-600 mb-6">Challenge your friends to a game of chess!</p>
          <div className="w-full space-y-4">
            <button 
              onClick={() => { 
                setMode('create');
                const newRoomId = generateRoomId();
                setCreateRoomId(newRoomId);
              }} 
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span className="text-xl">🎯</span>
              <span>Create New Game</span>
            </button>
            <button 
              onClick={() => { setMode('join'); }} 
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span className="text-xl">🚀</span>
              <span>Join Game</span>
            </button>
          </div>
        </div>
      );
    }
    if (mode === 'create') {
      return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl shadow-xl border border-gray-200 space-y-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl animate-pulse">🎯</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Room Created!</h2>
          </div>
          <div className="text-center space-y-4">
            <p className="text-gray-600">Share this code with your opponent:</p>
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 shadow-inner">
              <div className="text-4xl font-mono font-bold text-gray-800 tracking-wider select-all cursor-pointer hover:text-blue-600 transition-colors">
                {createRoomId}
              </div>
              <p className="text-xs text-gray-500 mt-2">Click to copy</p>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span>Waiting for opponent to join...</span>
            </div>
          </div>
          <div className="w-full flex flex-col items-center space-y-2 mt-4">
            <label className="block text-sm font-medium text-gray-700">Bet Amount (USDC)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              placeholder="Bet Amount"
              className="border rounded p-2 w-full text-center text-gray-700"
              required
            />
            <button
              onClick={handlePlaceBetAndCreateGame}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 mt-2"
            >
              <span className="text-xl">🎯</span>
              <span>Place Bet & Create Game</span>
            </button>
          </div>
          <button 
            onClick={() => { setInGame(false); setMode('choose'); }} 
            className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
          >
            Back to menu
          </button>
        </div>
      );
    }
    if (mode === 'join') {
      return (
        <div className="flex flex-col items-center w-full max-w-md mx-auto p-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl border border-gray-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">🚀</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Join Game</h2>
          </div>
          <form onSubmit={e => { e.preventDefault(); handleJoinRoom(); }} className="w-full space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Room Code</label>
              <input
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 font-mono text-center text-lg uppercase text-gray-700"
                placeholder="Enter room code"
                value={joinRoomId}
                onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bet Amount (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={joinBetAmount}
                onChange={e => setJoinBetAmount(e.target.value)}
                placeholder="Bet Amount"
                className="border rounded p-2 w-full text-center text-gray-700 "
                required
              />
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                disabled={isPending}
              >
                {isPending ? 'Joining...' : 'Join Game'}
              </button>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="w-full text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
              >
                Back to menu
              </button>
            </div>
          </form>
        </div>
      );
    }
  }

  if (!isConnected && isEthProviderAvailable) {
    return (
      <div className="flex flex-col items-center w-full max-w-xs mx-auto p-4 bg-white rounded-lg shadow-md space-y-4">
        <div className="mb-2 text-center font-bold">Chess Wager</div>
        {/* Create Game Flow */}
        {createStep === 'idle' && !showBetInput && (
          <button
            onClick={handleCreateRoom}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            Create New Game
          </button>
        )}
        {(createStep === 'roomGenerated' || createStep === 'pendingTx') && showBetInput && (
          <>
            <input
              className="border rounded p-2 w-full text-center bg-gray-100"
              placeholder="Room ID"
              value={createRoomId}
              readOnly
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              placeholder="Bet Amount (USDC)"
              className="border rounded p-2 w-full text-center text-gray-700"
              required
            />
            <button
              onClick={handlePlaceBetAndCreateGame}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 mt-2"
              disabled={createStep === 'pendingTx'}
            >
              {createStep === 'pendingTx' ? 'Placing Bet...' : 'Place Bet & Create Game'}
            </button>
            <button
              onClick={() => { setShowBetInput(false); setCreateRoomId(''); setBetAmount(''); setCreateStep('idle'); }}
              className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-xl mt-2"
              disabled={createStep === 'pendingTx'}
            >
              Cancel
            </button>
          </>
        )}
        {/* Join Game Flow */}
        {!showJoinBetInput ? (
          <button
            onClick={() => { setShowJoinBetInput(true); setShowBetInput(false); }}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            Join Room
          </button>
        ) : (
          <>
            <input
              className="border rounded p-2 w-full text-center"
              placeholder="Room ID"
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value.toUpperCase())}
              maxLength={12}
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={joinBetAmount}
              onChange={e => setJoinBetAmount(e.target.value)}
              placeholder="Bet Amount (USDC)"
              className="border rounded p-2 w-full text-center text-gray-700"
              required
            />
            <button
              onClick={handleJoinRoom}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 mt-2"
            >
              Join Game
            </button>
            <button
              onClick={() => { setShowJoinBetInput(false); setJoinRoomId(''); setJoinBetAmount(''); }}
              className="w-full bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-xl mt-2"
            >
              Cancel
            </button>
          </>
        )}
        {isConnected && (
          <button
            type="button"
            className="bg-gray-200 text-gray-700 w-full rounded-md p-2 text-sm mt-2"
            onClick={() => disconnect()}
          >
            Disconnect Wallet
          </button>
        )}
      </div>
    );
  }

  if (isConnected && chainId !== monadTestnet.id) {
    return (
      <div className="flex flex-col items-center w-full max-w-xs mx-auto p-4 bg-white rounded-lg shadow-md">
        <button
          type="button"
          className="bg-yellow-500 text-white w-full rounded-md p-2 text-sm"
          onClick={() => switchChain({ chainId: monadTestnet.id })}
        >
          Switch to Monad Testnet
        </button>
      </div>
    );
  }

  if (inGame) {
    return (
      <>
        <div className="w-full max-w-2xl mx-auto p-4">
       
        </div>
        <div className="w-full max-w-2xl mx-auto p-4">
          {/* Game Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">♛</span>
                </div>
                <div>
                   

                  <h3 className="text-lg font-bold">TurnOnMonad</h3>
                
                  <p className="text-sm text-gray-300">Room: <span className="font-mono text-yellow-400">{roomId}</span></p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
            
            {/* Player Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-2xl">♔</span>
                  <span className="font-semibold">White</span>
                  {color === 'white' && <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">You</span>}
                </div>
                {context?.user && color === 'white' && (
                  <p className="text-xs text-gray-300">{context.user.displayName}</p>
                )}
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-2xl">♚</span>
                  <span className="font-semibold">Black</span>
                  {color === 'black' && <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">You</span>}
                </div>
                {context?.user && color === 'black' && (
                  <p className="text-xs text-gray-300">{context.user.displayName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Game Status */}
          <div className="bg-white border-x-2 border-gray-200 p-4">
            {players < 2 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-2xl animate-pulse">⏳</span>
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Waiting for Opponent</h4>
                <p className="text-gray-600 mb-4">Share your room code with a friend to start playing!</p>
                <div className="bg-gray-100 rounded-lg p-3 inline-block">
                  <span className="font-mono text-lg font-bold text-gray-800">{roomId}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">Players: {players}/2</p>
              </div>
            ) : (
              <div className="text-center py-2">
                {gameResult ? (
                  <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4">
                    <div className="text-2xl mb-2">🏆</div>
                    <h4 className="text-lg font-bold text-gray-800">{getGameStatus(gameResult).message}</h4>
                  </div>
                ) : ( <></>)}
              </div>
            )}
          </div>

          {/* Chess Board */}
          <div className="bg-white border-x-2 border-gray-200 p-6">
            {players === 2 ? (
              <div className="flex flex-col items-center">
                <div className={`rounded-2xl p-4 transition-all duration-300 ${
                  isMyTurn 
                    ? 'bg-gradient-to-br from-blue-50 to-purple-50 shadow-2xl border-4 border-blue-300' 
                    : 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg border-4 border-gray-300'
                }`}>
                  {/* 3D/2D Toggle */}
                  <div className="mb-4 flex justify-center">
                    <button
                      onClick={() => setUse3D(!use3D)}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 text-sm font-semibold"
                    >
                      {use3D ? '🎮 Switch to 2D' : '🌍 Switch to 3D'}
                    </button>
                  </div>
                  
                  {use3D ? (
                    <Chess3D
                      fen={fen}
                      boardOrientation={color}
                      onSquareClick={handleSquareClick}
                      selectedSquare={selectedSquare}
                      isMyTurn={isMyTurn}
                    />
                  ) : (
                    <Chessboard
                      position={fen}
                      onPieceDrop={onDrop}
                      boardOrientation={color}
                      boardWidth={Math.min(window.innerWidth - 120, 400)}
                      customBoardStyle={{
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                      }}
                      customDarkSquareStyle={{ backgroundColor: '#B58863' }}
                      customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
                    />
                  )}
                </div>
                {process.env.NODE_ENV === 'development' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      className="bg-green-600 text-white px-4 py-2 rounded"
                      onClick={() => handleGameover({ result: '1-0' })}
                    >
                      Force White Win
                    </button>
                    <button
                      className="bg-black text-white px-4 py-2 rounded"
                      onClick={() => handleGameover({ result: '0-1' })}
                    >
                      Force Black Win
                    </button>
                    <button
                      className="bg-gray-400 text-white px-4 py-2 rounded"
                      onClick={() => handleGameover({ result: '1/2-1/2' })}
                    >
                      Force Draw
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center items-center h-96 bg-gray-100 rounded-2xl">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-gray-500 text-3xl">♟</span>
                  </div>
                  <p className="text-gray-500">Board will appear when both players join</p>
                </div>
              </div>
            )}
          </div>

          {/* Game Actions */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-b-2xl p-6">
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setInGame(false);
                  setMode('choose');
                  setGameResult('');
                  setRoomId('');
                  setFen('start');
                  setPlayers(0);
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Leave Game
              </button>
              {players === 2 && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to restart the game?')) {
                      // Emit restart event to server if implemented
                      setFen('start');
                      setGameResult('');
                    }
                  }}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  Restart
                </button>
              )}
            </div>
          </div>
         
        </div>
        
      </>
    );
  }

  return (
    <>
      <div className="w-full max-w-2xl mx-auto p-4">
       
      </div>
      {/* Game Header */}
      
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">♛</span>
            </div>
            <div>
               

              <h3 className="text-lg font-bold">TurnOnMonad</h3>
              <p className="text-sm text-gray-300">Room: <span className="font-mono text-yellow-400">{roomId}</span></p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        {/* Player Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-2xl">♔</span>
              <span className="font-semibold">White</span>
              {color === 'white' && <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">You</span>}
            </div>
            {context?.user && color === 'white' && (
              <p className="text-xs text-gray-300">{context.user.displayName}</p>
            )}
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-2xl">♚</span>
              <span className="font-semibold">Black</span>
              {color === 'black' && <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">You</span>}
            </div>
            {context?.user && color === 'black' && (
              <p className="text-xs text-gray-300">{context.user.displayName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Game Status */}
      <div className="bg-white border-x-2 border-gray-200 p-4">
        {players < 2 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl animate-pulse">⏳</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Waiting for Opponent</h4>
            <p className="text-gray-600 mb-4">Share your room code with a friend to start playing!</p>
            <div className="bg-gray-100 rounded-lg p-3 inline-block">
              <span className="font-mono text-lg font-bold text-gray-800">{roomId}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Players: {players}/2</p>
          </div>
        ) : (
          <div className="text-center py-2">
            {gameResult ? (
              <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4">
                <div className="text-2xl mb-2">🏆</div>
                <h4 className="text-lg font-bold text-gray-800">{getGameStatus(gameResult).message}</h4>
              </div>
            ) : ( <></>)}
          </div>
        )}
      </div>

      {/* Chess Board */}
      <div className="bg-white border-x-2 border-gray-200 p-6">
        {players === 2 ? (
          <div className="flex flex-col items-center">
            <div className={`rounded-2xl p-4 transition-all duration-300 ${
              isMyTurn 
                ? 'bg-gradient-to-br from-blue-50 to-purple-50 shadow-2xl border-4 border-blue-300' 
                : 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg border-4 border-gray-300'
            }`}>
              {/* 3D/2D Toggle */}
              <div className="mb-4 flex justify-center">
                <button
                  onClick={() => setUse3D(!use3D)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 text-sm font-semibold"
                >
                  {use3D ? '🎮 Switch to 2D' : '🌍 Switch to 3D'}
                </button>
              </div>
              
              {use3D ? (
                <Chess3D
                  fen={fen}
                  boardOrientation={color}
                  onSquareClick={handleSquareClick}
                  selectedSquare={selectedSquare}
                  isMyTurn={isMyTurn}
                />
              ) : (
                <Chessboard
                  position={fen}
                  onPieceDrop={onDrop}
                  boardOrientation={color}
                  boardWidth={Math.min(window.innerWidth - 120, 400)}
                  customBoardStyle={{
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                  }}
                  customDarkSquareStyle={{ backgroundColor: '#B58863' }}
                  customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
                />
              )}
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="flex gap-2 mt-4">
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={() => handleGameover({ result: '1-0' })}
                >
                  Force White Win
                </button>
                <button
                  className="bg-black text-white px-4 py-2 rounded"
                  onClick={() => handleGameover({ result: '0-1' })}
                >
                  Force Black Win
                </button>
                <button
                  className="bg-gray-400 text-white px-4 py-2 rounded"
                  onClick={() => handleGameover({ result: '1/2-1/2' })}
                >
                  Force Draw
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center items-center h-96 bg-gray-100 rounded-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-500 text-3xl">♟</span>
              </div>
              <p className="text-gray-500">Board will appear when both players join</p>
            </div>
          </div>
        )}
      </div>

      {/* Game Actions */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-b-2xl p-6">
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => {
              setInGame(false);
              setMode('choose');
              setGameResult('');
              setRoomId('');
              setFen('start');
              setPlayers(0);
            }}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            Leave Game
          </button>
          {players === 2 && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to restart the game?')) {
                  // Emit restart event to server if implemented
                  setFen('start');
                  setGameResult('');
                }
              }}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Restart
            </button>
          )}
        </div>
        
      </div>
     
    </>
  );
} 