import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, getDocsFromServer, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { fetchCollectionREST } from '../lib/firestoreRest'
import { generateChecklistReport, generateCertificate } from '../lib/pdfGenerator'

const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || 'Tatva2024').trim()

const formatDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso || '—' }
}
const formatDateTime = (iso) => {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso || '—' }
}
const yesCount = (checklist) =>
  checklist ? Object.values(checklist).filter((v) => v === 'Yes').length : 0

function downloadPdf(docObj, filename) {
  const blob = docObj.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const STATUS_BADGE = {
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending:  'bg-amber-100 text-amber-700',
}
const STATUS_LABEL = { approved: '✓ Approved', rejected: '✗ Rejected', pending: '⏳ Pending' }

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
      <div className="card max-w-sm w-full p-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: '#f5eefa' }}>
          <svg className="w-6 h-6" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Admin Panel</h2>
        <p className="text-slate-400 text-sm text-center mb-6">Enter password to continue</p>
        <form onSubmit={(e) => { e.preventDefault(); pw === ADMIN_PASSWORD ? onLogin() : (setError(true), setPw('')) }} className="space-y-4">
          <div>
            <input type="password" className={`form-input ${error ? 'border-red-400' : ''}`}
              placeholder="Password" value={pw} autoFocus
              onChange={(e) => { setPw(e.target.value); setError(false) }} />
            {error && <p className="text-red-500 text-xs mt-1">Incorrect password</p>}
          </div>
          <button type="submit" className="btn-primary w-full">Login</button>
        </form>
      </div>
    </div>
  )
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ submission, onClose, onSave }) {
  const [decision, setDecision] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = decision && (decision === 'approved' || comment.trim())

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    await onSave(submission, decision, comment.trim())
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">Review Submission</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-slate-600 text-sm mb-5">
          <span className="font-semibold">{submission.doctorName}</span> — {submission.clinicName}
          <span className="text-slate-400 ml-2 text-xs">({yesCount(submission.checklist)}/20 modules completed)</span>
        </p>

        {/* Decision cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button type="button" onClick={() => setDecision('approved')}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              decision === 'approved' ? 'bg-green-50 border-green-500' : 'bg-white border-slate-200 hover:border-green-300'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${decision === 'approved' ? 'bg-green-500' : 'bg-slate-100'}`}>
                <svg className={`w-4 h-4 ${decision === 'approved' ? 'text-white' : 'text-slate-400'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className={`font-bold text-sm ${decision === 'approved' ? 'text-green-700' : 'text-slate-600'}`}>Approve</span>
            </div>
            <p className="text-xs text-slate-400 pl-9">Training complete. Certificate will be enabled.</p>
          </button>

          <button type="button" onClick={() => setDecision('rejected')}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              decision === 'rejected' ? 'bg-red-50 border-red-500' : 'bg-white border-slate-200 hover:border-red-300'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${decision === 'rejected' ? 'bg-red-500' : 'bg-slate-100'}`}>
                <svg className={`w-4 h-4 ${decision === 'rejected' ? 'text-white' : 'text-slate-400'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className={`font-bold text-sm ${decision === 'rejected' ? 'text-red-700' : 'text-slate-600'}`}>Reject</span>
            </div>
            <p className="text-xs text-slate-400 pl-9">Incomplete training. Reason required.</p>
          </button>
        </div>

        {/* Comment */}
        {decision && (
          <div className={`rounded-lg p-3 mb-4 ${decision === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <label className={`block text-sm font-semibold mb-1.5 ${decision === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
              {decision === 'rejected' ? 'Rejection Reason *' : 'Approval Note (optional)'}
            </label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              rows={3}
              placeholder={decision === 'rejected'
                ? 'e.g. Pharmacy module not completed. Re-training required.'
                : 'e.g. All modules completed. Doctor is ready to use the system.'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 px-5 rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              decision === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {decision ? `Confirm ${decision.charAt(0).toUpperCase() + decision.slice(1)}` : 'Select a decision'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ submission, onClose, onReview }) {
  if (!submission) return null
  const status = submission.handoverStatus || 'pending'
  const isApproved = status === 'approved'
  const isPending = status === 'pending'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">{submission.doctorName}</h3>
            <p className="text-slate-400 text-xs">{submission.clinicName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status] || STATUS_BADGE.pending}`}>
              {STATUS_LABEL[status] || 'Pending'}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Onboarding Date',    submission.onboardingDate ? formatDate(submission.onboardingDate) : '—'],
              ['Training Date',      formatDate(submission.trainingDate)],
              ['Submitted At',       formatDateTime(submission.submittedAt)],
              ['Doctor Phone',       submission.doctorPhone || '—'],
              ['City / State',       [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ') || '—'],
              ['Complete Address',   submission.completeAddress || '—'],
              ['Clinic Name',        submission.clinicName],
              ['Clinic Type',        submission.clinicType || '—'],
              ['No. of Staff',       submission.noOfStaff || '—'],
              ['Frontdesk No.',      submission.frontdeskNumber || '—'],
              ['Receptionist Name',  submission.receptionistName || '—'],
              ['BDM',                submission.bdmName],
              ['BDM Phone',          submission.bdmPhone || '—'],
              ['AM',                 submission.amName || '—'],
              ['Support Member',     submission.supportMember],
              ['Device',             submission.deviceDetails || '—'],
              ['Internet Type',      submission.internetType || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                <p className="font-medium text-slate-700 text-xs">{v}</p>
              </div>
            ))}
          </div>

          {/* Comments */}
          {(submission.supportComment || submission.additionalComments) && (
            <div className="space-y-2">
              {submission.supportComment && (
                <div className={`rounded-lg px-3 py-2 text-sm ${isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-xs font-semibold mb-0.5 ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
                    {isApproved ? 'Support Approval Note' : 'Support Rejection Reason'}
                  </p>
                  <p className="text-slate-700">{submission.supportComment}</p>
                </div>
              )}
              {submission.additionalComments && (
                <div className="rounded-lg px-3 py-2 text-sm bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Additional Comments (BDM)</p>
                  <p className="text-slate-700">{submission.additionalComments}</p>
                </div>
              )}
            </div>
          )}

          {/* Module checklist */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Module Status</p>
            <div className="grid grid-cols-2 gap-1.5">
              {submission.checklist && Object.entries(submission.checklist).map(([mod, val]) => (
                <div key={mod} className="flex items-center justify-between bg-slate-50 rounded px-2.5 py-1.5">
                  <span className="text-xs text-slate-600">{mod}</span>
                  <span className={`text-xs font-bold ${val === 'Yes' ? 'text-green-600' : val === 'No' ? 'text-red-600' : 'text-slate-400'}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {isPending && (
              <button onClick={() => { onClose(); onReview(submission) }}
                className="flex-1 text-white font-semibold text-sm py-2.5 px-5 rounded-lg transition-colors"
                style={{ background: 'linear-gradient(90deg,#432d85,#703b96)' }}>
                Review This Submission
              </button>
            )}
            <button
              onClick={() => downloadPdf(generateChecklistReport(submission), `Checklist_${submission.doctorName.replace(/\s+/g, '_')}.pdf`)}
              className="flex-1 btn-primary text-sm py-2">
              Download Report
            </button>
            <button
              onClick={() => isApproved && downloadPdf(generateCertificate(submission), `Certificate_${submission.doctorName.replace(/\s+/g, '_')}.pdf`)}
              disabled={!isApproved}
              title={!isApproved ? 'Certificate available after approval' : ''}
              className={`flex-1 font-semibold text-sm py-2 px-5 rounded-lg transition-colors ${
                isApproved
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
              {isApproved ? 'Download Certificate' : 'Certificate (Pending Approval)'}
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [firebaseReadError, setFirebaseReadError] = useState('')
  const [dataSource, setDataSource] = useState('loading')

  const [refreshTick, setRefreshTick] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!authed) return
    let cancelled = false

    const loadData = async () => {
      // Step 1: show localStorage instantly
      const localRaw = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
      const localData = [...localRaw].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
      if (!cancelled) { setSubmissions(localData); setDataSource('local'); setLoading(false) }

      // Step 2: try SDK → REST API → SDK cache (in order)
      if (!isFirebaseConfigured || !db) return
      if (!cancelled) setSyncing(true)

      const applyDocs = (docs) => {
        if (cancelled) return
        const fbTimes = new Set(docs.map(d => d.submittedAt))
        const merged = [...docs, ...localData.filter(s => !fbTimes.has(s.submittedAt))]
          .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
        setSubmissions(merged); setDataSource('firebase'); setFirebaseReadError('')
      }

      const race = (p) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 10000))])

      try {
        // 1. SDK direct server
        const snap = await race(getDocsFromServer(collection(db, 'submissions')))
        applyDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch {
        try {
          // 2. REST API over plain HTTPS (bypasses gRPC block)
          const docs = await race(fetchCollectionREST('submissions'))
          applyDocs(docs)
        } catch {
          try {
            // 3. SDK local cache
            const snap = await getDocs(collection(db, 'submissions'))
            applyDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            if (!cancelled) setFirebaseReadError('Showing cached data — server unreachable')
          } catch (e) {
            if (!cancelled) setFirebaseReadError(e.message || 'All sync methods failed')
          }
        }
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [authed, refreshTick])

  const handleReview = async (submission, decision, comment) => {
    const update = { handoverStatus: decision, supportComment: comment, reviewedAt: new Date().toISOString() }

    // Update localStorage and in-memory state immediately
    const data = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
    const idx = data.findIndex((s) => s.submittedAt === submission.submittedAt)
    if (idx !== -1) { data[idx] = { ...data[idx], ...update }; localStorage.setItem('tc_submissions', JSON.stringify(data)) }
    setSubmissions((prev) => prev.map((s) => s.submittedAt === submission.submittedAt ? { ...s, ...update } : s))

    // Also push to Firebase in background
    if (isFirebaseConfigured && db && submission.id && !submission.id.startsWith('local_')) {
      updateDoc(doc(db, 'submissions', submission.id), update).catch(e => console.error('Review update failed:', e))
    }
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const counts = { all: submissions.length, pending: 0, approved: 0, rejected: 0 }
  submissions.forEach((s) => {
    const st = s.handoverStatus || 'pending'
    if (counts[st] !== undefined) counts[st]++
  })

  const filtered = submissions.filter((s) => {
    const matchSearch = (s.doctorName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.clinicName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.bdmName || '').toLowerCase().includes(search.toLowerCase())
    const st = s.handoverStatus || 'pending'
    const matchStatus = statusFilter === 'all' || st === statusFilter
    return matchSearch && matchStatus
  })

  const tabs = [
    { key: 'all',      label: 'All',      color: 'text-slate-600' },
    { key: 'pending',  label: 'Pending',  color: 'text-amber-600' },
    { key: 'approved', label: 'Approved', color: 'text-green-600' },
    { key: 'rejected', label: 'Rejected', color: 'text-red-600'   },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
      {/* Header */}
      <div className="shadow" style={{ background: 'linear-gradient(90deg, #432d85 0%, #703b96 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-purple-200 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-bold text-lg">Admin Panel</h1>
              <p className="text-purple-200 text-xs">
              {syncing
                ? '🔄 Syncing with server…'
                : dataSource === 'firebase'
                  ? '🟢 All devices synced'
                  : '🟡 Local data — tap ↺ to sync'}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRefreshTick(t => t + 1)} title="Sync from server" disabled={syncing}
              className="text-purple-200 hover:text-white transition-colors p-1 rounded disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {submissions.length} total
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Firebase error */}
        {firebaseReadError && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-red-700 text-sm font-semibold">Firebase read blocked</p>
              <p className="text-red-600 text-xs mt-0.5">{firebaseReadError}</p>
            </div>
          </div>
        )}

        {/* Search + Status Filters */}
        <div className="card p-4 mb-5 space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" className="form-input pl-9" placeholder="Search by doctor, clinic, or BDM…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border ${
                  statusFilter === tab.key
                    ? 'border-transparent text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300 ' + tab.color
                }`}
                style={statusFilter === tab.key ? { background: 'linear-gradient(90deg,#432d85,#703b96)' } : {}}>
                {tab.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                  statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>{counts[tab.key]}</span>
              </button>
            ))}
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
              <p className="font-medium text-slate-500">{search ? 'No results found' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}submissions`}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['#', 'Doctor', 'Clinic', 'Training Date', 'BDM', 'Support Member', 'Device', 'Yes', 'Status', 'Submitted', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s, i) => {
                    const st = s.handoverStatus || 'pending'
                    const isApproved = st === 'approved'
                    const isPending = st === 'pending'
                    return (
                      <tr key={s.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{s.doctorName}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.clinicName}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(s.trainingDate)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.bdmName}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.supportMember || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.deviceDetails || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            {yesCount(s.checklist)} / 20
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[st] || STATUS_BADGE.pending}`}>
                            {STATUS_LABEL[st] || 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(s.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelected(s)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 rounded">
                              View
                            </button>
                            {isPending && (
                              <button onClick={() => setReviewing(s)}
                                className="text-xs font-semibold px-2 py-1 rounded text-white whitespace-nowrap"
                                style={{ background: 'linear-gradient(90deg,#432d85,#703b96)' }}>
                                Review
                              </button>
                            )}
                            <button onClick={() => downloadPdf(generateChecklistReport(s), `Checklist_${s.doctorName.replace(/\s+/g, '_')}.pdf`)}
                              className="text-xs text-slate-500 hover:text-blue-600 font-medium px-2 py-1 hover:bg-blue-50 rounded">
                              Report
                            </button>
                            <button
                              onClick={() => isApproved && downloadPdf(generateCertificate(s), `Certificate_${s.doctorName.replace(/\s+/g, '_')}.pdf`)}
                              disabled={!isApproved}
                              title={!isApproved ? 'Available after approval' : 'Download certificate'}
                              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                                isApproved ? 'text-green-600 hover:text-green-800 hover:bg-green-50' : 'text-slate-300 cursor-not-allowed'
                              }`}>
                              Cert
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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

      {selected && <DetailModal submission={selected} onClose={() => setSelected(null)} onReview={(s) => { setSelected(null); setReviewing(s) }} />}
      {reviewing && <ReviewModal submission={reviewing} onClose={() => setReviewing(null)} onSave={handleReview} />}
    </div>
  )
}
