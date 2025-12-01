import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = 'coordi'
const collectionName = 'users'

export async function GET(req: Request) {
  if (!uri) {
    return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 500 })
  }

  // Get address from query params
  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  let client: MongoClient | undefined
  try {
    client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)
    
    // Find user by address
    const user = await db.collection(collectionName).findOne({ 
      address: address.toLowerCase() 
    })

    if (!user) {
      return NextResponse.json(null)
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user info:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    )
  } finally {
    if (client) await client.close()
  }
} 