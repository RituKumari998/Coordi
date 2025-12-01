import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAccount, useConnect } from 'wagmi'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'

type SquareValue = 'X' | 'O' | null

function Square({ value, onSquareClick }: { value: SquareValue; onSquareClick: () => void }) {
  return (
    <button
      className="w-24 h-24 border-2 border-gray-400 text-4xl font-bold hover:bg-gray-100 transition-colors text-black"
      onClick={onSquareClick}
    >
      {value}
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
      <div className="w-full">
        <div className="flex flex-col items-center space-y-6 bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-black">Enter Game Code</h2>
          {isConnected ? (
            <div className="flex flex-col w-full max-w-md space-y-4">
              <div className="flex flex-col space-y-2">
                <input
                  type="text"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  placeholder="Enter game code"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <div className="flex space-x-2">
                  <button
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    onClick={createNewGame}
                  >
                    New Game
                  </button>
                  <button
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    onClick={startGame}
                  >
                    Join Game
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <p className="text-gray-600">Please connect your wallet to start playing</p>
              <button
                className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-lg font-semibold"
                onClick={() => connect({ connector: farcasterFrame() })}
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex flex-col items-center space-y-6 bg-white p-8 rounded-lg shadow-lg">
        {!bothPlayersConnected ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="text-xl font-semibold text-gray-600">
              {isHost ? 'Waiting for opponent to join...' : 'Connecting to game...'}
            </div>
            <div className="text-sm text-gray-500">
              Game Code: <span className="font-mono font-bold">{gameCode}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center space-y-4">
              <div className="text-xl font-semibold text-green-600">Connected! Game is ready to play</div>
              <div className="text-sm text-gray-500">{isHost ? 'You are X' : 'You are O'} (Opponent is {isHost ? 'O' : 'X'})</div>
            </div>
            <div className="text-3xl font-bold mb-4 text-black">{status}</div>
            <div className="grid grid-cols-3 gap-3">
              {squares.map((square, i) => (
                <Square key={i} value={square} onSquareClick={() => handleClick(i)} />
              ))}
            </div>
            {gameOver && (
              <button
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                onClick={resetGame}
              >
                Play Again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
