// Calls the Vercel proxy at /api/submissions (backed by firebase-admin server-side)
// instead of talking to Firestore directly. This bypasses network-level blocks
// on Google's endpoints and keeps Firestore access rules-restricted-to-server-only.

export const fetchCollectionREST = async (token) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch('/api/submissions', { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `Proxy ${res.status}`)
    err.status = res.status
    throw err
  }
  const json = await res.json()
  return json.submissions || []
}

export const checkDuplicateREST = async (doctorName, clinicName) => {
  const params = new URLSearchParams({ doctorName, clinicName })
  const res = await fetch(`/api/submissions?${params}`)
  if (!res.ok) throw new Error(`Proxy ${res.status}`)
  const json = await res.json()
  return json.match || null
}

export const searchSubmissionsREST = async (search) => {
  if (!search) return []
  const params = new URLSearchParams({ search })
  const res = await fetch(`/api/submissions?${params}`)
  if (!res.ok) throw new Error(`Proxy ${res.status}`)
  const json = await res.json()
  return json.results || []
}

export const addDocumentREST = async (data) => {
  const res = await fetch('/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Proxy write ${res.status}`)
  const json = await res.json()
  return json.id || null
}

export const updateDocumentREST = async (id, update, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/submissions', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ id, fields: update, updateMask: Object.keys(update) }),
  })
  if (!res.ok) throw new Error(`Proxy update ${res.status}`)
}
