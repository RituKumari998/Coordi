import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = 'coordi'
const collectionName = 'users'

export async function POST(req: Request) {
  if (!uri) {
    return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 500 })
  }

  let client: MongoClient | undefined
  try {
    const body = await req.json()
    const { fid, displayName, pfpUrl, username, address } = body
    if (!fid || !address) {
      return NextResponse.json({ error: 'fid and address are required' }, { status: 400 })
    }
    client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)
    // Upsert user info by fid
    const result = await db.collection(collectionName).updateOne(
      { fid },
      { $set: { fid, displayName, pfpUrl, username, address, updatedAt: new Date() } },
      { upsert: true }
    )
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  } finally {
    if (client) await client.close()
  }
} 