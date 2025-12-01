import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = 'coordi'
const collectionName = 'groups'

export async function GET(req: Request) {
  if (!uri) {
    return NextResponse.json({ error: 'MONGODB_URI not set' }, { status: 500 })
  }

  let client: MongoClient | undefined
  try {
    client = new MongoClient(uri)
    await client.connect()
    const db = client.db(dbName)
    const groups = await db.collection(collectionName).find({}).toArray()
    // console.log(groups)

    // Get address from query params
    const url = new URL(req.url)
    // console.log(url)
    const address = url.searchParams.get('address')
    console.log("address", address)
    if (address) {
      // Filter groups where the address is present in the members array
      const filteredGroups = groups.filter((group: any) =>
        Array.isArray(group.members) &&
        group.members.some((member: any) =>
          typeof member.ethAddress === 'string' &&
          member.ethAddress.toLowerCase() === address.toLowerCase()
        )
      )
      console.log("filteredGroups", filteredGroups)
      return NextResponse.json(filteredGroups)
    }
    // console.log(groups)
    return NextResponse.json(groups)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  } finally {
    if (client) await client.close()
  }
} 