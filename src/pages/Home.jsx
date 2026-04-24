import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, isFirebaseConfigured } from '../lib/firebase'

const SOP_URL = import.meta.env.VITE_SOP_URL || ''

export default function Home() {
  const navigate = useNavigate()
  const [showUpload, setShowUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [selected, setSelected] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [uploadError, setUploadError] = useState('')

  const handleSOP = () => {
    if (SOP_URL) {
      window.open(SOP_URL, '_blank', 'noopener,noreferrer')
    } else {
      alert('SOP URL not configured.\n\nAdd VITE_SOP_URL to your .env file to link your SOP document.')
    }
  }

  const handleOpenUpload = async () => {
    setShowUpload(true)
    setLoadingSearch(true)
    setSearchQuery('')
    setSelected(null)
    setUploadFile(null)
    setUploadStatus('idle')
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(query(collection(db, 'submissions'), orderBy('submittedAt', 'desc')))
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error(e)
      }
    }
    setLoadingSearch(false)
  }

  const handleClose = () => {
    setShowUpload(false)
    setSearchQuery('')
    setSelected(null)
    setUploadFile(null)
    setUploadStatus('idle')
    setUploadError('')
  }

  const handleUpload = async () => {
    if (!uploadFile || !selected) return
    setUploadStatus('uploading')
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timed out. Check Firebase Storage rules.')), 20000))
    try {
      const storageRef = ref(storage, `signed-checklists/${selected.id}_${Date.now()}_${uploadFile.name}`)
      await Promise.race([uploadBytes(storageRef, uploadFile), timeout])
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'submissions', selected.id), { signedChecklistUrl: url })
      setUploadStatus('done')
    } catch (e) {
      console.error('Upload error:', e)
      setUploadError(e.message || 'Upload failed. Check Firebase Storage rules.')
      setUploadStatus('error')
    }
  }

  const filtered = submissions.filter(s =>
    s.doctorName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
      {/* Navbar */}
      <nav style={{ background: 'linear-gradient(90deg, #432d85 0%, #703b96 100%)' }} className="shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <span className="font-black text-lg leading-none" style={{ color: '#703b96' }}>T</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">TatvaCare</p>
              <p className="text-purple-200 text-xs">Healthcare Technology</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="text-purple-200 hover:text-white text-sm flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin Panel
          </button>
        </div>
      </nav>

      {/* Demo Banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-amber-700 text-sm">
              <strong>Demo Mode</strong> — Firebase not configured. Data is saved locally in the browser.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold mb-3" style={{ color: '#432d85' }}>
          Training &amp; Handover Portal
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Complete training documentation, generate certificates, and maintain handover records for all clinic onboardings.
        </p>
      </div>

      {/* Main Cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* SOP Card */}
          <button
            onClick={handleSOP}
            className="card p-8 text-left hover:shadow-md transition-all group"
            style={{ borderColor: '#e9d8f5' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#b87fdc'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e9d8f5'}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors" style={{ background: '#f5eefa' }}>
              <svg className="w-7 h-7" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">SOP Document</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              Standard Operating Procedure for training and onboarding. Reference this document before conducting any clinic training session.
            </p>
            <span className="inline-flex items-center gap-1.5 font-semibold text-sm group-hover:gap-2.5 transition-all" style={{ color: '#703b96' }}>
              Open Document
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </button>

          {/* Checklist Card */}
          <button
            onClick={() => navigate('/checklist')}
            className="card p-8 text-left hover:shadow-md transition-all group"
            style={{ background: 'linear-gradient(135deg, #432d85 0%, #703b96 100%)', borderColor: '#703b96' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Training Completion Checklist</h2>
            <p className="text-purple-200 text-sm leading-relaxed mb-5">
              Record completed training modules, generate a detailed checklist report, and issue a training certificate for the doctor.
            </p>
            <span className="inline-flex items-center gap-1.5 text-white font-semibold text-sm group-hover:gap-2.5 transition-all">
              Start Checklist
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </span>
          </button>
        </div>

        {/* Stats strip */}
        <div className="mt-10 card p-5">
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            <div className="text-center px-4">
              <p className="text-2xl font-bold" style={{ color: '#703b96' }}>20</p>
              <p className="text-slate-500 text-xs mt-0.5">Modules Covered</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold" style={{ color: '#703b96' }}>2</p>
              <p className="text-slate-500 text-xs mt-0.5">PDFs Generated</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold" style={{ color: '#703b96' }}>1</p>
              <p className="text-slate-500 text-xs mt-0.5">Click Submission</p>
            </div>
          </div>
        </div>

        {/* Upload Signed Checklist */}
        <div className="mt-6">
          {!showUpload ? (
            <button
              onClick={handleOpenUpload}
              className="w-full card p-5 text-left hover:shadow-md transition-all flex items-center justify-between group"
              style={{ borderColor: '#e9d8f5' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#b87fdc'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e9d8f5'}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5eefa' }}>
                  <svg className="w-6 h-6" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-800">Upload Signed Checklist</p>
                  <p className="text-slate-500 text-sm">Search a doctor and upload their signed checklist form</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="card p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f5eefa' }}>
                    <svg className="w-5 h-5" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-800">Upload Signed Checklist</h3>
                </div>
                <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  className="form-input pl-9"
                  placeholder="Search doctor name…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelected(null); setUploadStatus('idle') }}
                  autoFocus
                />
              </div>

              {/* Results */}
              {loadingSearch ? (
                <p className="text-slate-400 text-sm text-center py-4">Loading submissions…</p>
              ) : searchQuery.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 mb-4">
                  {filtered.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">No doctor found</p>
                  ) : (
                    filtered.slice(0, 10).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelected(s); setUploadFile(null); setUploadStatus('idle'); setUploadError('') }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${selected?.id === s.id ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                      >
                        <p className="font-semibold text-slate-800 text-sm">{s.doctorName}</p>
                        <p className="text-xs text-slate-400">{s.clinicName} · {s.trainingDate || '—'}</p>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Upload area */}
              {selected && (
                <div className="rounded-lg p-4 mt-2" style={{ background: '#f5eefa', border: '1px solid #d3b2eb' }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#432d85' }}>
                    {selected.doctorName} — {selected.clinicName}
                  </p>

                  {uploadStatus === 'done' ? (
                    <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Signed checklist uploaded successfully!
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => setUploadFile(e.target.files[0])}
                        className="block w-full text-sm text-slate-600 mb-3 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-white file:text-purple-700 hover:file:bg-purple-50"
                      />
                      {uploadStatus === 'error' && (
                        <p className="text-red-500 text-xs mb-2">{uploadError || 'Upload failed. Please try again.'}</p>
                      )}
                      <button
                        onClick={handleUpload}
                        disabled={!uploadFile || uploadStatus === 'uploading'}
                        className="flex items-center gap-2 text-white text-sm font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        style={{ background: 'linear-gradient(90deg,#432d85,#703b96)' }}
                      >
                        {uploadStatus === 'uploading' ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Uploading…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload Signed Checklist
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
