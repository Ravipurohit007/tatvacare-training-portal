// Firestore REST API — works on networks where the gRPC-based SDK is blocked

const base = () =>
  `https://firestore.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`
const key = () => import.meta.env.VITE_FIREBASE_API_KEY

const parseValue = (v) => {
  if ('stringValue'    in v) return v.stringValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('nullValue'      in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue'       in v) {
    const out = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = parseValue(val)
    return out
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue)
  return null
}

const toValue = (val) => {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number')  return { doubleValue: val }
  if (typeof val === 'string')  return { stringValue: val }
  if (Array.isArray(val))       return { arrayValue: { values: val.map(toValue) } }
  if (typeof val === 'object') {
    const fields = {}
    for (const [k, v] of Object.entries(val)) fields[k] = toValue(v)
    return { mapValue: { fields } }
  }
  return { stringValue: String(val) }
}

const parseDoc = (doc) => {
  const id = doc.name.split('/').pop()
  const data = {}
  for (const [k, v] of Object.entries(doc.fields || {})) data[k] = parseValue(v)
  return { id, ...data }
}

export const fetchCollectionREST = async (col) => {
  const res = await fetch(`${base()}/${col}?pageSize=200&key=${key()}`)
  if (!res.ok) throw new Error(`REST read ${res.status}`)
  const json = await res.json()
  return (json.documents || []).map(parseDoc)
}

export const addDocumentREST = async (col, data) => {
  const fields = {}
  for (const [k, v] of Object.entries(data)) fields[k] = toValue(v)
  const res = await fetch(`${base()}/${col}?key=${key()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`REST write ${res.status}`)
}
