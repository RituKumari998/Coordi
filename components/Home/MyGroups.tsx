import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useFrame } from '@/components/farcaster-provider'
import { FaUsers, FaClock, FaCheckCircle, FaSpinner, FaExclamationCircle, FaWallet } from 'react-icons/fa'
import { IoIosArrowBack } from 'react-icons/io'

interface GroupMember {
  inboxId: string
  ethAddress: string
  name: string
  pfp: string
  username: string
  groupId: string
  joinedAt: Date
}

interface Group {
  groupId: string
  groupName: string
  members: GroupMember[]
  lastUpdated: string
}

export default function MyGroups() {
  const { address } = useAccount()
  const { context } = useFrame()
  const [groups, setGroups] = useState<Group[]>([])
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinStatus, setJoinStatus] = useState<{ [groupId: string]: string }>({})

  // Fetch groups
  useEffect(() => {
    if (!address) {
      setGroups([])
      setJoinedGroupIds([])
      setLoading(false)
      return
    }
    setLoading(true)
    
    fetch(`/api/groups?address=${encodeURIComponent(address)}`)
      .then(res => res.json())
      .then(groupsData => {
        setGroups(groupsData)
        const joined = groupsData.filter((group: Group) =>
          group.members.some((member: GroupMember) => member.ethAddress.toLowerCase() === address.toLowerCase())
        ).map((group: Group) => group.groupId)
        setJoinedGroupIds(joined)
        setLoading(false)
      })
      .catch(err => {
        setError('Failed to fetch groups')
        setLoading(false)
      })
  }, [address])

  const handleJoin = async (groupId: string) => {
    if (!context?.user?.fid || !address) return
    setJoinStatus(s => ({ ...s, [groupId]: 'loading' }))
    const res = await fetch('/api/join-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        groupId, 
        fid: context.user.fid, 
        address,
        displayName: context.user.displayName,
        pfpUrl: context.user.pfpUrl,
        username: context.user.username
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setJoinStatus(s => ({ ...s, [groupId]: 'joined' }))
      setJoinedGroupIds(ids => [...ids, groupId])
    } else {
      setJoinStatus(s => ({ ...s, [groupId]: data.error || 'error' }))
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaWallet className="text-4xl text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
          <p className="text-white/70">Connect your wallet to view and join groups</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <FaSpinner className="text-5xl text-blue-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-bold text-white mb-2">Loading Groups</h3>
          <p className="text-white/70">Fetching your available groups...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-red-500/30">
          <FaExclamationCircle className="text-5xl text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Error Loading Groups</h3>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-fade-in">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaUsers className="text-4xl text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Groups Found</h3>
          <p className="text-white/70">You don't have any groups available at the moment</p>
        </div>
      </div>
    )
  }

  // Filter out groups the user has already joined
  const availableGroups = groups.filter(group => joinedGroupIds.includes(group.groupId))

  return (
    <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3">
          <FaUsers className="text-blue-600" />
          My Groups
        </h2>
        <p className="text-gray-600">Groups you've joined and can participate in</p>
      </div>

      {availableGroups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableGroups.map(group => {
            const status = joinStatus[group.groupId]
            const memberCount = group.members?.length || 0
            return (
              <div
                key={group.groupId}
                className="glass-dark rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:scale-105 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <FaUsers className="text-white text-xl" />
                  </div>
                  {status === 'joined' && (
                    <div className="flex items-center gap-1 text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
                      <FaCheckCircle className="text-sm" />
                      <span className="text-xs font-semibold">Joined</span>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{group.groupName}</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <FaUsers className="text-xs" />
                    <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <FaClock className="text-xs" />
                    <span className="truncate">{new Date(group.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  {status === 'joined' ? (
                    <div className="w-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 font-semibold py-2 px-4 rounded-lg text-center text-sm border border-green-500/30">
                      <FaCheckCircle className="inline mr-2" />
                      Joined
                    </div>
                  ) : (
                    <button
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                      disabled={status === 'loading'}
                      onClick={() => handleJoin(group.groupId)}
                    >
                      {status === 'loading' ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          <span>Joining...</span>
                        </>
                      ) : (
                        <span>Join Group</span>
                      )}
                    </button>
                  )}
                  {status && status !== 'joined' && status !== 'loading' && (
                    <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                      <FaExclamationCircle />
                      <span>{status}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-dark rounded-3xl p-8 text-center border border-white/10">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-500/20 to-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FaUsers className="text-4xl text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Available Groups</h3>
          <p className="text-white/70">You haven't joined any groups yet</p>
        </div>
      )}
    </div>
  )
} 