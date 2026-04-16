import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { generateChecklistReport, generateCertificate } from '../lib/pdfGenerator'

const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'Tatva2024').trim()

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

const formatDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const yesCount = (checklist) =>
  checklist ? Object.values(checklist).filter((v) => v === 'Yes').length : 0

function downloadPdf(doc, filename) {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      onLogin()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="card max-w-sm w-full p-8">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Admin Panel</h2>
        <p className="text-slate-400 text-sm text-center mb-6">Enter password to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              className={`form-input ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="Password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false) }}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1">Incorrect password</p>}
          </div>
          <button type="submit" className="btn-primary w-full">
            Login
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ submission, onClose }) {
  if (!submission) return null
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">{submission.doctorName}</h3>
            <p className="text-slate-400 text-xs">{submission.clinicName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-5">
          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Training Date',        formatDate(submission.trainingDate)],
              ['Submitted At',         formatDateTime(submission.submittedAt)],
              ['Doctor Phone',         submission.doctorPhone || '—'],
              ['City / State',         [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ') || '—'],
              ['Clinic',               submission.clinicName],
              ['No. of Staff',         submission.noOfStaff || '—'],
              ['Frontdesk No.',        submission.frontdeskNumber || '—'],
              ['BDM',                  submission.bdmName],
              ['AM',                   submission.amName || '—'],
              ['Support Team',         submission.supportMember],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                <p className="font-medium text-slate-700">{v}</p>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Module Status
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {submission.checklist &&
                Object.entries(submission.checklist).map(([mod, val]) => (
                  <div key={mod} className="flex items-center justify-between bg-slate-50 rounded px-2.5 py-1.5">
                    <span className="text-xs text-slate-600">{mod}</span>
                    <span className={`text-xs font-bold ${
                      val === 'Yes' ? 'text-green-600' :
                      val === 'No'  ? 'text-red-600'   : 'text-slate-400'
                    }`}>{val}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => downloadPdf(
                generateChecklistReport(submission),
                `Checklist_${submission.doctorName.replace(/\s+/g, '_')}.pdf`
              )}
              className="flex-1 btn-primary text-sm py-2"
            >
              Download Checklist Report
            </button>
            <button
              onClick={() => downloadPdf(
                generateCertificate(submission),
                `Certificate_${submission.doctorName.replace(/\s+/g, '_')}.pdf`
              )}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-2 px-5 rounded-lg transition-colors"
            >
              Download Certificate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!authed) return

    if (isFirebaseConfigured && db) {
      const q = query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'))
      const unsub = onSnapshot(q, (snap) => {
        setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      })
      return unsub
    } else {
      const data = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
      setSubmissions(data)
      setLoading(false)
    }
  }, [authed])

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const filtered = submissions.filter(
    (s) =>
      s.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
      s.clinicName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-blue-800 shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-blue-200 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-bold text-lg">Admin Panel</h1>
              <p className="text-blue-200 text-xs">
                {isFirebaseConfigured ? 'Live Firebase data' : 'Demo — localStorage data'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-blue-700 text-blue-100 text-xs font-semibold px-3 py-1 rounded-full">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="card p-4 mb-5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="form-input pl-9"
              placeholder="Search by doctor name or clinic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading submissions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-medium text-slate-500">
                {search ? 'No results found' : 'No submissions yet'}
              </p>
              {!search && (
                <p className="text-sm mt-1">
                  Submissions will appear here after the checklist is filled.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Clinic</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Training Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">BDM</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Yes Modules</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Submitted</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{s.doctorName}</td>
                      <td className="px-4 py-3 text-slate-600">{s.clinicName}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(s.trainingDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{s.bdmName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          {yesCount(s.checklist)} / 18
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDateTime(s.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelected(s)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => downloadPdf(
                              generateChecklistReport(s),
                              `Checklist_${s.doctorName.replace(/\s+/g, '_')}.pdf`
                            )}
                            className="text-xs text-slate-500 hover:text-blue-600 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                            title="Download checklist report"
                          >
                            Report
                          </button>
                          <button
                            onClick={() => downloadPdf(
                              generateCertificate(s),
                              `Certificate_${s.doctorName.replace(/\s+/g, '_')}.pdf`
                            )}
                            className="text-xs text-slate-500 hover:text-green-600 font-medium px-2 py-1 hover:bg-green-50 rounded transition-colors"
                            title="Download certificate"
                          >
                            Cert
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-slate-400 text-xs mt-3 text-right">
            Showing {filtered.length} of {submissions.length} submissions
          </p>
        )}
      </div>

      {/* Detail Modal */}
      {selected && <DetailModal submission={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
