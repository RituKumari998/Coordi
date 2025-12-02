'use client'

import { useState, useEffect, useRef } from 'react'

import { FaUserCircle, FaWallet, FaChess, FaUsers, FaGamepad } from 'react-icons/fa'
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io'
import { IoMdLogOut } from 'react-icons/io'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import MyGroups from './MyGroups'
// import DoodleJump from '../DoodleJump/index'
import MyGroupInfo from './MyGroupInfo'
import io from 'socket.io-client';
import ChessGame from '../Chess/ChessGame'
import { Socket } from 'socket.io-client'

type CellValue = 'RED' | 'YELLOW' | null

function Cell({ value, onClick, isClickable }: { value: CellValue, onClick: () => void, isClickable: boolean }) {
  const getCellColor = () => {
    if (value === 'RED') return 'bg-red-500'
    if (value === 'YELLOW') return 'bg-yellow-500'
    return 'bg-gray-100 hover:bg-gray-200'
  }

  return (
    <button 
      className={`w-16 h-16 rounded-full border-2 border-gray-400 transition-colors ${getCellColor()} ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={onClick}
      disabled={!isClickable}
    >
    </button>
  )
}

import { useFrame } from '../farcaster-provider'

const games = [
  {
    id: 1,
    title: 'Chess PvP',
    description: 'Play chess against another player',
    image: 'https://placehold.co/400x300/2563eb/white?text=Chess+PvP'
  }
]

export function Demo() {
  const [currentGameIndex, setCurrentGameIndex] = useState(0)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const { context } = useFrame();
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { connect } = useConnect()
  const [showMyGroups, setShowMyGroups] = useState(false)
  const [showMyGroupInfo, setShowMyGroupInfo] = useState(false)
  const sentUserInfoRef = useRef<{ fid: number | undefined, address: string | undefined }>({ fid: undefined, address: undefined })
  const [userInGroup, setUserInGroup] = useState<boolean | null>(null)

  const handleChangeAccount = async () => {
    try {
      // Disconnect current wallet
      await disconnect()
      // Reconnect with Farcaster Frame to trigger wallet selection
      await connect({ connector: farcasterFrame() })
      setShowProfileMenu(false)
    } catch (error) {
      console.error('Error changing wallet:', error)
    }
  }

  const nextGame = () => {
    setCurrentGameIndex((prev) => (prev + 1) % games.length)
  }

  const prevGame = () => {
    setCurrentGameIndex((prev) => (prev - 1 + games.length) % games.length)
  }

  const handleGameSelect = (gameId: number) => {
    if (gameId === 1) {
      setSelectedGame('chesspvp');
    }
  }

  useEffect(() => {
    if (context?.user?.fid && address) {
      const key = `userInfoSaved_${context.user.fid}_${address.toLowerCase()}`
      if (!localStorage.getItem(key)) {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: context.user.fid,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
            username: context.user.username,
            address,
          }),
        })
        localStorage.setItem(key, 'true')
      }
    }
  }, [context?.user?.fid, address, context?.user?.displayName, context?.user?.pfpUrl, context?.user?.username])

  useEffect(() => {
    if (!address) {
      setUserInGroup(null)
      return
    }
    fetch(`/api/my-group?ethAddress=${encodeURIComponent(address)}&fid=${context}`)
      .then(res => res.json())
      .then(data => {
        setUserInGroup(!data.error)
      })
      .catch(() => setUserInGroup(false))
  }, [address])

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex flex-col">
      {/* Header with Profile */}
      <header className="glass-dark border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-bold">C</span>
            </div>
            <h1 className="text-xl font-bold gradient-text hidden sm:block">Coordi</h1>
          </div>
          
          {selectedGame === 'connectfour' && (
            <button
              onClick={() => setSelectedGame(null)}
              className="flex items-center text-gray-700 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-white/20"
            >
              <IoIosArrowBack className="mr-1" />
              <span className="hidden sm:inline">Back to Games</span>
            </button>
          )}
          
          <div className="relative ml-auto">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative transition-transform hover:scale-110 duration-200"
            >
              {context?.user ? (
                <>
                  {context?.user?.pfpUrl && (
                    <div className="relative">
                      <img
                        src={context?.user?.pfpUrl}
                        className="w-12 h-12 rounded-full border-2 border-white/30 shadow-lg ring-2 ring-blue-500/20"
                        alt="User Profile"
                        width={48}
                        height={48}
                      />
                      {isConnected && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                  <FaUserCircle className="text-white text-2xl" />
                </div>
              )}
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-72 glass-dark rounded-2xl shadow-2xl py-2 z-50 animate-slide-down border border-white/10">
                {!isConnected ? (
                  <button
                    className="flex items-center w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors rounded-lg mx-2"
                    onClick={() => {
                      connect({ connector: farcasterFrame() })
                      setShowProfileMenu(false)
                    }}
                  >
                    <FaWallet className="mr-3 text-lg" />
                    <span className="font-medium">Connect Wallet</span>
                  </button>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-white/10 mx-2">
                      <p className="text-sm text-white/90 font-medium truncate mb-1">
                        {context?.user?.displayName || 'User'}
                      </p>
                      <p className="text-xs text-white/60 font-mono truncate">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        Chain ID: {chainId}
                      </p>
                    </div>
                    <button
                      className="flex items-center w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors rounded-lg mx-2"
                      onClick={handleChangeAccount}
                    >
                      <FaUserCircle className="mr-3 text-lg" />
                      <span className="font-medium">Change Account</span>
                    </button>
                    <button
                      className="flex items-center w-full text-left px-4 py-3 text-sm text-red-300 hover:bg-red-500/20 transition-colors rounded-lg mx-2"
                      onClick={() => {
                        disconnect()
                        setShowProfileMenu(false)
                      }}
                    >
                      <IoMdLogOut className="mr-3 text-lg" />
                      <span className="font-medium">Disconnect</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 scrollbar-hide max-w-7xl mx-auto px-4 py-8 w-full">
        {showMyGroupInfo ? (
          <div className="flex flex-col items-center animate-fade-in">
            <MyGroupInfo />
            <button
              className="mt-6 btn-primary"
              onClick={() => setShowMyGroupInfo(false)}
            >
              ← Back to Main
            </button>
          </div>
        ) : showMyGroups ? (
          <div className="animate-fade-in">
            <MyGroups />
          </div>
        ) : selectedGame === 'connectfour' ? (
          <div className="flex flex-col items-center animate-fade-in">
            {/* Connect Four game implementation and references removed */}
          </div>
        ) : selectedGame === 'chesspvp' ? (
          <div className="animate-fade-in">
            <ChessGame setSelectedGame={setSelectedGame} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold gradient-text mb-4">Select a Game</h1>
              <p className="text-gray-600 text-lg">Challenge friends, place bets, and win rewards</p>
            </div>
            
            {/* Game Carousel */}
            <div className="relative max-w-5xl mx-auto">
              <div 
                className="overflow-hidden rounded-3xl shadow-2xl cursor-pointer card-hover group"
                onClick={() => handleGameSelect(games[currentGameIndex].id)}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10"></div>
                  <img
                    src={games[currentGameIndex].image}
                    alt={games[currentGameIndex].title}
                    className="w-full h-[500px] object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <FaChess className="text-white text-2xl" />
                      </div>
                      <h2 className="text-4xl font-bold text-white drop-shadow-lg">
                        {games[currentGameIndex].title}
                      </h2>
                    </div>
                    <p className="text-white/90 text-lg mb-4 drop-shadow-md">
                      {games[currentGameIndex].description}
                    </p>
                    <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
                      <span className="text-white text-sm font-medium">Click to Play →</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <button
                onClick={prevGame}
                className="absolute left-4 top-1/2 -translate-y-1/2 glass hover:bg-white/30 p-3 rounded-full shadow-xl transition-all duration-200 hover:scale-110 z-30"
                aria-label="Previous game"
              >
                <IoIosArrowBack className="text-white" size={28} />
              </button>
              <button
                onClick={nextGame}
                className="absolute right-4 top-1/2 -translate-y-1/2 glass hover:bg-white/30 p-3 rounded-full shadow-xl transition-all duration-200 hover:scale-110 z-30"
                aria-label="Next game"
              >
                <IoIosArrowForward className="text-white" size={28} />
              </button>

              {/* Game Selection Dots */}
              <div className="flex justify-center mt-6 space-x-3">
                {games.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentGameIndex(index)}
                    className={`transition-all duration-300 ${
                      index === currentGameIndex 
                        ? 'w-10 h-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg' 
                        : 'w-3 h-3 bg-gray-300 hover:bg-gray-400 rounded-full'
                    }`}
                    aria-label={`Go to game ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Footer with Switch Button */}
      <footer className="glass-dark border-t border-white/10 py-6 mt-auto backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 flex justify-center space-x-4">
          {!selectedGame && !showMyGroups && !showMyGroupInfo && userInGroup === false && (
            <button
              className="btn-primary flex items-center space-x-2"
              onClick={() => setShowMyGroups(true)}
            >
              <FaUsers />
              <span>Show My Groups</span>
            </button>
          )}
          {!selectedGame && !showMyGroups && !showMyGroupInfo && userInGroup === true && (
            <button
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center space-x-2"
              onClick={() => setShowMyGroupInfo(true)}
            >
              <FaGamepad />
              <span>My Active Game</span>
            </button>
          )}
          {showMyGroups && !showMyGroupInfo && (
            <button
              className="btn-primary flex items-center space-x-2"
              onClick={() => setShowMyGroups(false)}
            >
              <IoIosArrowBack />
              <span>Back to Games</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
