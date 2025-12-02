import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAccount, useConnect } from 'wagmi'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'

type SquareValue = 'X' | 'O' | null

function Square({ value, onSquareClick }: { value: SquareValue; onSquareClick: () => void }) {
  return (
    <button
      className="w-24 h-24 border-2 border-gray-300 bg-white/90 hover:bg-white text-4xl font-bold transition-all duration-200 hover:scale-105 hover:shadow-lg rounded-lg text-gray-800 active:scale-95"
      onClick={onSquareClick}
    >
      <span className={value === 'X' ? 'text-blue-600' : value === 'O' ? 'text-red-600' : ''}>
        {value}
      </span>
    </button>
  )
}

function calculateWinner(squares: Array<SquareValue>) {
  if (!squares) return null

  const lines: Array<[number, number, number]> = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]
    }
  }
  return null
}

export default function TicTacToe() {
  const [squares, setSquares] = useState<SquareValue[]>(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState<boolean>(true)
  const [gameCode, setGameCode] = useState<string>('')
  const [gameStarted, setGameStarted] = useState<boolean>(false)
  const { isConnected, address } = useAccount()
  const { connect } = useConnect()
  const [isMyTurn, setIsMyTurn] = useState<boolean>(false)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [opponentConnected, setOpponentConnected] = useState<boolean>(false)
  const [bothPlayersConnected, setBothPlayersConnected] = useState<boolean>(false)
  const [isHost, setIsHost] = useState<boolean>(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (gameStarted && address && gameCode) {
      const socket = io('http://localhost:4000', {
        path: '/socket.io',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        forceNew: true,
      })

      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('get-game-state', { gameCode })
      })

      socket.on('connect_error', (error) => console.error('Socket connection error:', error.message))
      socket.on('error', (error) => console.error('Socket error:', error))

      if (isHost) {
        socket.emit('create-room', { playerAddress: address, gameCode }, (response: { success: boolean; error?: string }) => {
          if (!response.success) alert(response.error || 'Failed to create room')
        })
      } else {
        socket.emit('join-room', { playerAddress: address, gameCode }, (response: { success: boolean; error?: string }) => {
          if (!response.success) {
            alert(response.error || 'Failed to join room')
          } else {
            setOpponentConnected(true)
            setBothPlayersConnected(true)
          }
        })
      }

      socket.on('opponent-connected', () => {
        setOpponentConnected(true)
        setBothPlayersConnected(true)
      })

      socket.emit('player-connected', { gameCode, playerAddress: address, isHost })

      socket.on('move-made', (data) => {
        setIsMyTurn(true)
        if (data.squares) {
          const newSquares = data.squares.map((square: SquareValue) => square)
          setSquares(newSquares)

          const nextTurn = data.currentTurn === 'X' ? 'O' : 'X'
          setXIsNext(nextTurn === 'X')
          setIsMyTurn((nextTurn === 'X' && isHost) || (nextTurn === 'O' && !isHost))

          const winner = calculateWinner(newSquares)
          if (winner || newSquares.every((square: SquareValue) => square !== null)) {
            setGameOver(true)
          }
        }
      })

      socket.on('game-state', (data) => {
        if (data.squares) {
          setSquares(data.squares)
          setXIsNext(data.currentTurn === 'X')
          setIsMyTurn(data.currentTurn === (isHost ? 'X' : 'O'))
          setGameOver(data.gameOver || false)
        }
      })

      socket.on('disconnect', () => {
        setOpponentConnected(false)
        setBothPlayersConnected(false)
      })

      socket.on('player-disconnected', () => {
        setOpponentConnected(false)
        setBothPlayersConnected(false)
      })

      return () => {
        socket.disconnect()
        setOpponentConnected(false)
        setBothPlayersConnected(false)
      }
    }
  }, [gameStarted, address, gameCode, isHost])

  const handleClick = (i: number) => {
    if (squares[i] || gameOver || !isMyTurn || !socketRef.current || !bothPlayersConnected) return

    const nextSquares = [...squares]
    const currentSymbol = isHost ? 'X' : 'O'
    nextSquares[i] = currentSymbol

    setSquares(nextSquares)
    const nextTurn = currentSymbol === 'X' ? 'O' : 'X'
    setXIsNext(nextTurn === 'X')
    setIsMyTurn(false)

    socketRef.current.emit('make-move', {
      gameCode,
      squares: nextSquares,
      currentTurn: nextTurn,
      playerAddress: address,
      isHost,
      moveIndex: i,
      symbol: currentSymbol,
    })

    const winner = calculateWinner(nextSquares)
    if (winner || nextSquares.every((square: SquareValue) => square !== null)) {
      setGameOver(true)
    }
  }

  const generateGameCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

  const startGame = () => {
    if (!gameCode.trim()) {
      alert('Please enter a game code')
      return
    }
    setGameStarted(true)
  }

  const createNewGame = () => {
    const newCode = generateGameCode()
    setGameCode(newCode)
    setIsHost(true)
    setGameStarted(true)
  }

  const resetGame = () => {
    setSquares(Array(9).fill(null))
    setXIsNext(true)
    setIsMyTurn(isHost)
    setGameOver(false)
    socketRef.current?.emit('reset-game', { gameCode })
  }

  useEffect(() => {
    socketRef.current?.on('game-reset', () => {
      setSquares(Array(9).fill(null))
      setXIsNext(true)
      setIsMyTurn(isHost)
      setGameOver(false)
    })
  }, [isHost])

  useEffect(() => {
    socketRef.current?.on('game-update', (data) => {
      if (data.squares) {
        setSquares(data.squares)
        setXIsNext(data.currentTurn === 'X')
        setIsMyTurn(data.currentTurn === (isHost ? 'X' : 'O'))
        setGameOver(data.gameOver || false)
      }
    })
  }, [isHost])

  const winner = calculateWinner(squares)
  const isDraw = squares.every((square: SquareValue) => square !== null) && !winner
  const status = winner
    ? `Winner: ${winner}`
    : isDraw
    ? 'Game is a draw!'
    : `Next player: ${xIsNext ? 'X' : 'O'} (${xIsNext === isHost ? 'Your turn' : "Opponent's turn"})`

  if (!gameStarted) {
    return (
      <div className="w-full max-w-2xl mx-auto animate-fade-in">
        <div className="flex flex-col items-center space-y-8 glass-dark p-10 rounded-3xl shadow-2xl border border-white/20">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl">⭕</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Tic-Tac-Toe</h2>
          </div>
          {isConnected ? (
            <div className="flex flex-col w-full max-w-md space-y-6">
              <div className="flex flex-col space-y-4">
                <label className="text-white/90 font-medium text-sm">Game Code</label>
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Enter game code"
                  maxLength={6}
                  className="w-full px-5 py-4 bg-white/10 border-2 border-white/20 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/50 focus:border-blue-500 text-white placeholder-white/50 font-mono text-center text-xl uppercase backdrop-blur-md transition-all"
                />
                <div className="flex space-x-3">
                  <button
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    onClick={createNewGame}
                  >
                    🎯 New Game
                  </button>
                  <button
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                    onClick={startGame}
                  >
                    🚀 Join Game
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6">
              <p className="text-white/80 text-lg">Please connect your wallet to start playing</p>
              <button
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
                onClick={() => connect({ connector: farcasterFrame() })}
              >
                <span>🔗</span>
                <span>Connect Wallet</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex flex-col items-center space-y-8 glass-dark p-10 rounded-3xl shadow-2xl border border-white/20">
        {!bothPlayersConnected ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-2xl font-semibold text-white">
              {isHost ? 'Waiting for opponent to join...' : 'Connecting to game...'}
            </div>
            <div className="text-sm text-white/70 bg-white/10 px-4 py-2 rounded-lg">
              Game Code: <span className="font-mono font-bold text-white">{gameCode}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="flex items-center space-x-2 text-green-400 font-semibold text-lg">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span>Connected! Game is ready to play</span>
              </div>
              <div className="text-sm text-white/70 bg-white/10 px-4 py-2 rounded-lg">
                {isHost ? 'You are X' : 'You are O'} (Opponent is {isHost ? 'O' : 'X'})
              </div>
            </div>
            <div className={`text-2xl font-bold mb-2 px-6 py-3 rounded-xl ${
              winner ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border border-green-500/30' :
              isDraw ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30' :
              'bg-white/10 text-white border border-white/20'
            }`}>
              {status}
            </div>
            <div className="grid grid-cols-3 gap-4 p-6 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10">
              {squares.map((square, i) => (
                <Square key={i} value={square} onSquareClick={() => handleClick(i)} />
              ))}
            </div>
            {gameOver && (
              <button
                className="mt-6 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                onClick={resetGame}
              >
                🎮 Play Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
