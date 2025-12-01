'use client'

import { useState, useEffect, useRef } from 'react'

import { FaUserCircle, FaWallet } from 'react-icons/fa'
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
    <div className="min-h-screen w-[100%] bg-gray-100 flex flex-col">
      {/* Header with Profile */}
      <header className="bg-white shadow-sm">
        
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center relative">
          {selectedGame === 'connectfour' && (
            <button
              onClick={() => setSelectedGame(null)}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <IoIosArrowBack className="mr-1" />
              Back to Games
            </button>
          )}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="text-gray-600 hover:text-gray-800"
            >
              {context?.user ? (
                <>
                  {context?.user?.pfpUrl && (
                    <img
                      src={context?.user?.pfpUrl}
                      className="w-10 h-10 rounded-full"
                      alt="User Profile"
                      width={45}
                      height={45}
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-left">User context not available</p>
              )}
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-black rounded-md shadow-lg py-1 z-10">
                {!isConnected ? (
                  <button
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                    onClick={() => {
                      connect({ connector: farcasterFrame() })
                      setShowProfileMenu(false)
                    }}
                  >
                    <FaWallet className="mr-2" />
                    Connect Wallet
                  </button>
                ) : (
                  <>
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="text-sm text-gray-300 truncate">
                        {address}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Chain ID: {chainId}
                      </p>
                    </div>
                    <button
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                      onClick={handleChangeAccount}
                    >
                      <FaUserCircle className="mr-2" />
                      Change Account
                    </button>
                    <button
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700"
                      onClick={() => {
                        disconnect()
                        setShowProfileMenu(false)
                      }}
                    >
                      <IoMdLogOut className="mr-2" />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 scroll-bar-hidden max-w-7xl mx-auto px-4 py-8 w-full">
        {showMyGroupInfo ? (
          <div className="flex flex-col items-center">
            <MyGroupInfo />
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => setShowMyGroupInfo(false)}
            >
              Back to Main
            </button>
          </div>
        ) : showMyGroups ? (
          <MyGroups />
        ) : selectedGame === 'connectfour' ? (
          <div className="flex flex-col items-center">
            {/* Connect Four game implementation and references removed */}
          </div>
        ) : selectedGame === 'chesspvp' ? (
          <ChessGame setSelectedGame={setSelectedGame} />
        ) : (
          <>
            <h1 className="text-3xl text-black font-bold text-center mb-8">Select a Game</h1>
            
            {/* Game Carousel */}
            <div className="relative max-w-4xl mx-auto">
              <div 
                className="overflow-hidden rounded-lg shadow-lg cursor-pointer"
                onClick={() => handleGameSelect(games[currentGameIndex].id)}
              >
                <div className="relative">
                  <img
                    src={games[currentGameIndex].image}
                    alt={games[currentGameIndex].title}
                    className="w-full h-[400px] object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {games[currentGameIndex].title}
                    </h2>
                    <p className="text-white/90">
                      {games[currentGameIndex].description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <button
                onClick={prevGame}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white p-2 rounded-full shadow-lg"
              >
                <IoIosArrowBack className="text-black" size={24} />
              </button>
              <button
                onClick={nextGame}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white p-2 rounded-full shadow-lg"
              >
                <IoIosArrowForward className="text-black" size={24} />
              </button>

              {/* Game Selection Dots */}
              <div className="flex justify-center mt-4 space-x-2">
                {games.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentGameIndex(index)}
                    className={`w-3 h-3 rounded-full ${
                      index === currentGameIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
      {/* Footer with Switch Button */}
      <footer className="bg-white shadow-inner py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex justify-center space-x-2">
          {!selectedGame && !showMyGroups && !showMyGroupInfo && userInGroup === false && (
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={() => setShowMyGroups(true)}
            >
              Show My Groups
            </button>
          )}
          {!selectedGame && !showMyGroups && !showMyGroupInfo && userInGroup === true && (
            <button
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              onClick={() => setShowMyGroupInfo(true)}
            >
              My Group
            </button>
          )}
          {showMyGroups && !showMyGroupInfo && (
            <button
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              onClick={() => setShowMyGroups(false)}
            >
              Back to Games
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
