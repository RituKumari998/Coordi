import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useFrame } from '@/components/farcaster-provider'

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
    return <div className="p-4 text-center text-gray-500">Connect your wallet to see groups.</div>
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading groups...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>
  }

  if (groups.length === 0) {
    return <div className="p-4 text-center text-gray-500">No groups found.</div>
  }

  // Filter out groups the user has already joined
  const availableGroups = groups.filter(group => joinedGroupIds.includes(group.groupId))

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Available Groups</h2>
      <ul className="space-y-3">
        {availableGroups.length > 0 ? availableGroups.map(group => {
          const status = joinStatus[group.groupId]
          return (
            <li key={group.groupId} className="p-4 bg-white rounded shadow flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">{group.groupName}</div>
                <div className="text-xs text-gray-500">Group ID: {group.groupId}</div>
                <div className="text-xs text-gray-400">Last updated: {new Date(group.lastUpdated).toLocaleString()}</div>
              </div>
              <div className="mt-2 md:mt-0">
                {status === 'joined' ? (
                  <span className="text-green-600 font-semibold">Joined</span>
                ) : (
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    disabled={status === 'loading'}
                    onClick={() => handleJoin(group.groupId)}
                  >
                    {status === 'loading' ? 'Joining...' : 'Join Group'}
                  </button>
                )}
                {status && status !== 'joined' && status !== 'loading' && (
                  <div className="text-xs text-red-500 mt-1">{status}</div>
                )}
              </div>
            </li>
          )
        }) : <div className="text-center text-gray-500">No available groups</div>}
      </ul>
    </div>
  )
} 