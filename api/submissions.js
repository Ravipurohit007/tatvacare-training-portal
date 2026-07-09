// Vercel serverless function — all Firestore access for this app goes through
// here using a Firebase Admin service account (Firestore rules deny direct
// client access entirely; this function is the only trusted path).
//
// Access model:
//   GET   - with a verified @tatvacare.in token on ADMIN_ALLOWED_EMAILS -> full collection
//           - with ?doctorName=&clinicName=                            -> single duplicate-check match
//           - with ?search=                                            -> name-substring matches (capped)
//           - otherwise                                                -> 400 (no anonymous full dump)
//   POST  - open (anonymous submission creation from the Checklist form)
//   PATCH - with a verified allowlisted token -> any field
//           - without a token                -> only the signed-checklist-file fields

import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  })
}

const db = admin.firestore()
const SUPPORT_TEAM = ['Dilshab', 'Sukhanya', 'Tasleem', 'Ghousiya']
const ANON_ALLOWED_FIELDS = ['signedChecklistFile', 'signedChecklistName', 'signedChecklistUploadedAt']
const ALLOWED_ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

const docToObj = (doc) => ({ id: doc.id, ...doc.data() })

// Returns the decoded token if this is a verified @tatvacare.in account on the
// allowlist (or the allowlist is unset — fail open on domain only, so a missing
// env var can't lock everyone out). Returns null if there's no token at all.
// Throws AdminAuthError if a token was presented but rejected, so callers can
// tell "not trying to be admin" apart from "tried and isn't authorized".
class AdminAuthError extends Error {}

const verifyAdmin = async (req) => {
  const match = (req.headers.authorization || '').match(/^Bearer (.+)$/)
  if (!match) return null
  let decoded
  try {
    decoded = await admin.auth().verifyIdToken(match[1])
  } catch {
    throw new AdminAuthError('Invalid or expired sign-in token')
  }
  const email = decoded.email?.toLowerCase()
  const domainOk = decoded.email_verified && email?.endsWith('@tatvacare.in')
  const allowlistOk = ALLOWED_ADMIN_EMAILS.length === 0 || ALLOWED_ADMIN_EMAILS.includes(email)
  if (!domainOk || !allowlistOk) throw new AdminAuthError('This account is not authorized for admin access')
  return decoded
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  try {
    if (req.method === 'GET') {
      let adminUser
      try {
        adminUser = await verifyAdmin(req)
      } catch (e) {
        res.status(403).json({ error: e.message })
        return
      }
      if (adminUser) {
        const snap = await db.collection('submissions').get()
        res.status(200).json({ submissions: snap.docs.map(docToObj) })
        return
      }

      const { doctorName, clinicName, search } = req.query
      if (doctorName && clinicName) {
        const snap = await db.collection('submissions')
          .where('doctorName', '==', doctorName)
          .where('clinicName', '==', clinicName)
          .limit(1)
          .get()
        res.status(200).json({ match: snap.empty ? null : docToObj(snap.docs[0]) })
        return
      }

      if (search) {
        const q = String(search).toLowerCase()
        const snap = await db.collection('submissions').get()
        const results = snap.docs
          .map(docToObj)
          .filter((s) => s.doctorName?.toLowerCase().includes(q))
          .slice(0, 20)
        res.status(200).json({ results })
        return
      }

      res.status(400).json({ error: 'Missing query — provide doctorName+clinicName, search, or an admin token' })

    } else if (req.method === 'POST') {
      // Server-side round-robin: count existing docs to determine assignee
      const count = (await db.collection('submissions').count().get()).data().count
      const data = { ...body, supportMember: SUPPORT_TEAM[count % SUPPORT_TEAM.length] }
      const ref = await db.collection('submissions').add(data)
      res.status(200).json({ id: ref.id })

    } else if (req.method === 'PATCH') {
      const { id, fields, updateMask } = body
      if (!id || !fields || !Array.isArray(updateMask)) {
        res.status(400).json({ error: 'Missing id/fields/updateMask' })
        return
      }

      let adminUser
      try {
        adminUser = await verifyAdmin(req)
      } catch (e) {
        res.status(403).json({ error: e.message })
        return
      }
      if (!adminUser) {
        const disallowed = updateMask.some((f) => !ANON_ALLOWED_FIELDS.includes(f))
        if (disallowed) { res.status(403).json({ error: 'Not authorized to update these fields' }); return }
      }

      const update = {}
      for (const f of updateMask) update[f] = fields[f]
      await db.collection('submissions').doc(id).update(update)
      res.status(200).json({ ok: true })

    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
