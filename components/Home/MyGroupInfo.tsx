import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { FaUsers, FaTrophy, FaFire, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaSpinner, FaWallet, FaStar } from 'react-icons/fa'

export default function MyGroupInfo() {
  const { address } = useAccount()
  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    fetch(`/api/my-group?ethAddress=${encodeURIComponent(address)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setGroup(null)
        } else {
          setGroup(data.group)
          setError(null)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to fetch group info')
        setLoading(false)
      })
  }, [address])

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaWallet className="text-4xl text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
          <p className="text-white/70">Connect your wallet to view your group information</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <FaSpinner className="text-5xl text-blue-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-bold text-white mb-2">Loading Group Info</h3>
          <p className="text-white/70">Fetching your group details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-red-500/30">
          <FaExclamationTriangle className="text-5xl text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Error</h3>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaUsers className="text-4xl text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Active Group</h3>
          <p className="text-white/70">You are not currently in any group</p>
        </div>
      </div>
    )
  }

  // Only show verified members
  let verifiedMembers = group.members.filter(
    (member: any) => member.groupId && member.groupId === group.groupId
  )

  // Sort verified members by xp (descending for leaderboard)
  verifiedMembers = verifiedMembers.sort((a: any, b: any) => (Number(b.xp) || 0) - (Number(a.xp) || 0))

  // Check if the current user is verified
  const isUserVerified = verifiedMembers.some(
    (member: any) =>
      member.ethAddress?.toLowerCase() === address?.toLowerCase()
  )

  // Calculate total group XP
  const totalGroupXP = verifiedMembers.reduce(
    (sum: number, member: any) => sum + (Number(member.xp) || 0),
    0
  )

  return (
    <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
      {/* Group Header */}
      <div className="glass-dark rounded-3xl p-6 mb-6 border border-white/10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FaUsers className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{group.groupName}</h2>
              <p className="text-white/60 text-sm font-mono">ID: {group.groupId}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-yellow-400 mb-1">
              <FaTrophy className="text-xl" />
              <span className="text-2xl font-bold">{totalGroupXP.toLocaleString()}</span>
            </div>
            <p className="text-white/60 text-xs">Total Group XP</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-white/70 text-sm">
          <div className="flex items-center gap-2">
            <FaCalendarAlt />
            <span>Updated: {new Date(group.lastUpdated).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <FaUsers />
            <span>{verifiedMembers.length} {verifiedMembers.length === 1 ? 'member' : 'members'}</span>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      {!isUserVerified && (
        <div className="glass-dark rounded-2xl p-4 mb-6 border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-3">
            <FaExclamationTriangle className="text-red-400 text-xl" />
            <div>
              <p className="text-red-300 font-semibold">Not Verified</p>
              <p className="text-red-400/80 text-sm">You are not verified in this group and cannot check in.</p>
            </div>
          </div>
        </div>
      )}

      {/* Members Leaderboard */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <FaTrophy className="text-yellow-400" />
          Member Leaderboard
        </h3>
        <div className="space-y-3">
          {verifiedMembers.map((member: any, index: number) => {
            const isCurrentUser = member.ethAddress?.toLowerCase() === address?.toLowerCase()
            const memberXP = Number(member.xp) || 0
            const streak = Number(member.streak) || 0
            const longestStreak = Number(member.longestStreak) || 0
            
            return (
              <div
                key={member.ethAddress}
                className={`glass-dark rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] ${
                  isCurrentUser
                    ? 'border-blue-400/50 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {member.pfp ? (
                      <img
                        src={member.pfp}
                        alt={member.username}
                        className="w-12 h-12 rounded-full border-2 border-white/30 shadow-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                        <FaUsers className="text-white text-lg" />
                      </div>
                    )}
                  </div>

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white truncate">
                        {member.name || member.username}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">You</span>
                        )}
                      </p>
                    </div>
                    <p className="text-white/60 text-sm truncate">@{member.username}</p>
                    {member.baseName && (
                      <p className="text-white/50 text-xs truncate">Base: {member.baseName}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 text-yellow-400 mb-1">
                      <FaStar className="text-sm" />
                      <span className="font-bold">{memberXP.toLocaleString()}</span>
                    </div>
                    {streak > 0 && (
                      <div className="flex items-center gap-1 text-orange-400 text-xs">
                        <FaFire />
                        <span>{streak} day{streak !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs text-white/60">
                  {member.joinedAt && (
                    <div className="flex items-center gap-1">
                      <FaCalendarAlt />
                      <span>Joined: {new Date(member.joinedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {member.lastCheckIn && (
                    <div className="flex items-center gap-1">
                      <FaCheckCircle />
                      <span>Last: {new Date(member.lastCheckIn).toLocaleDateString()}</span>
                    </div>
                  )}
                  {longestStreak > 0 && (
                    <div className="flex items-center gap-1">
                      <FaFire />
                      <span>Best: {longestStreak} days</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
} 