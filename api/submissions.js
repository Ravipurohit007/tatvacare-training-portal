// Vercel serverless function — proxies Firestore REST API from Vercel's servers.
// Client networks that block googleapis.com can still reach this endpoint
// because it runs on Vercel infrastructure, which has no such restrictions.

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID
const API_KEY    = process.env.VITE_FIREBASE_API_KEY
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${FIRESTORE}/submissions?pageSize=500&key=${API_KEY}`)
      const data = await r.json()
      res.status(r.status).json(data)

    } else if (req.method === 'POST') {
      const r = await fetch(`${FIRESTORE}/submissions?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      })
      const data = await r.json()
      res.status(r.status).json(data)

    } else if (req.method === 'PATCH') {
      const { id, fields, updateMask } = req.body
      const mask = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
      const r = await fetch(`${FIRESTORE}/submissions/${id}?${mask}&key=${API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
      const data = await r.json()
      res.status(r.status).json(data)

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
