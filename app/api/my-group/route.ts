import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = 'coordi'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ethAddress = searchParams.get('ethAddress')
  const fid = searchParams.get('fid')
  console.log(fid)
  if (!ethAddress) return NextResponse.json({ error: 'Missing ethAddress' }, { status: 400 })
  const ethAddressLower = ethAddress.toLowerCase();

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const users = db.collection('users')
  const groups = db.collection('groups')

  const user = await users.findOne({ ethAddress: ethAddressLower })
  if (!user || !user.groupId) return NextResponse.json({ error: 'User not in a group' }, { status: 404 })

  const group = await groups.findOne({ groupId: user.groupId })
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  return NextResponse.json({ group })
} 