import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

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
    return <div className="p-4 text-center text-gray-500">Connect your wallet to see your group.</div>
  }
  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading your group...</div>
  }
  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>
  }
  if (!group) {
    return <div className="p-4 text-center text-gray-500">You are not in any group.</div>
  }

  // Only show verified members
  let verifiedMembers = group.members.filter(
    (member: any) => member.groupId && member.groupId === group.groupId
  )

  // Sort verified members by xp (ascending)
  verifiedMembers = verifiedMembers.sort((a: any, b: any) => (Number(a.xp) || 0) - (Number(b.xp) || 0))

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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">My Group: {group.groupName}</h2>
      <div className="mb-2 text-gray-500 text-xs">Group ID: {group.groupId}</div>
      <div className="mb-2 text-gray-400 text-xs">Last updated: {new Date(group.lastUpdated).toLocaleString()}</div>
      <div className="mb-4 text-blue-700 font-semibold">Group XP: {totalGroupXP}</div>
      <h3 className="font-semibold mb-2">Verified Members:</h3>
      <ul className="space-y-2">
        {verifiedMembers.map((member: any) => (
          <li key={member.ethAddress} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
            {member.pfp && <img src={member.pfp} alt={member.username} className="w-8 h-8 rounded-full" />}
            <div>
              <div className="font-medium">{member.name || member.username}</div>
              <div className="text-xs text-gray-500">@{member.username}</div>
              <div className="text-xs text-gray-400">baseName: {member.baseName}</div>
              <div className="text-xs text-gray-400">joinedAt: {member.joinedAt && new Date(member.joinedAt).toLocaleString()}</div>
              <div className="text-xs text-gray-400">lastCheckIn: {member.lastCheckIn && new Date(member.lastCheckIn).toLocaleString()}</div>
              <div className="text-xs text-gray-400">longestStreak: {member.longestStreak}</div>
              <div className="text-xs text-gray-400">streak: {member.streak}</div>
              <div className="text-xs text-blue-700 font-semibold">xp: {member.xp}</div>
            </div>
          </li>
        ))}
      </ul>
      {!isUserVerified && (
        <div className="mt-4 text-red-500 font-semibold">
          You are not verified in this group and cannot check in.
        </div>
      )}
    </div>
  )
} 