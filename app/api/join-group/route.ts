import { NextResponse } from 'next/server'
import { MongoClient, Document, UpdateFilter } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = 'coordi'
const collectionName = 'groups'

interface GroupMember {
  fid: string | number
  inboxId?: string
  ethAddress: string
  name: string
  pfp: string
  username: string
  groupId: string
  joinedAt: Date
}

interface Group extends Document {
  groupId: string
  groupName: string
  members: GroupMember[]
  lastUpdated: string
}

export async function POST(req: Request) {
  if (!uri) {
    return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 500 })
  }

  try {
    const { groupId, fid, address, displayName, pfpUrl, username } = await req.json()

    if (!groupId || !fid || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let client: MongoClient | undefined
    try {
      client = new MongoClient(uri)
      await client.connect()
      const db = client.db(dbName)
      const groupsCollection = db.collection(collectionName)

      // Find the group
      const group = await groupsCollection.findOne({ groupId })
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }

      // Check if user is already a member
      const existingMember = group.members?.find((member: any) => 
        member.ethAddress.toLowerCase() === address.toLowerCase()
      )

      const newMemberInfo = {
        fid: fid,
        ethAddress: address.toLowerCase(),
        name: displayName,
        pfp: pfpUrl,
        username: username,
        groupId: groupId,
        joinedAt: new Date()
      }

      let result
      if (existingMember) {
        // Update existing member's information while preserving existing fields
        result = await groupsCollection.updateOne(
          { 
            groupId,
            "members.ethAddress": address.toLowerCase()
          },
          {
            $set: {
              "members.$.fid": newMemberInfo.fid,
              "members.$.groupId": newMemberInfo.groupId,
              "members.$.name": newMemberInfo.name,
              "members.$.pfp": newMemberInfo.pfp,
              "members.$.username": newMemberInfo.username,
              "members.$.joinedAt": newMemberInfo.joinedAt
            }
          }
        )
      } else {
        // Add new member by appending to the members array
        result = await groupsCollection.updateOne(
          { groupId },
          {
            $push: { members: newMemberInfo }
          }
        )
      }

      // Upsert newMemberInfo into users collection
      const usersCollection = db.collection('users')
      await usersCollection.updateOne(
        { ethAddress: address.toLowerCase() },
        { $set: newMemberInfo },
        { upsert: true }
      )

      console.log(result)

      if (result.modifiedCount === 0) {
        return NextResponse.json({ error: 'Failed to join group' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } finally {
      if (client) await client.close()
    }
  } catch (error) {
    console.error('Error joining group:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 