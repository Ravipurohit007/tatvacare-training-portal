import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { CHECKLIST_ITEMS, STATUS_COLORS } from '../lib/constants'
import { generateChecklistReport, generateCertificate } from '../lib/pdfGenerator'

const initialChecklist = () =>
  Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item, 'NA']))

const initialForm = {
  doctorName: '',
  clinicName: '',
  trainingDate: '',
  bdmName: '',
  supportMember: '',
}

function StatusToggle({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {['Yes', 'No', 'NA'].map((opt) => {
        const active = value === opt
        const colors = STATUS_COLORS[opt]
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all border ${
              active
                ? `${colors.bg} ${colors.text} border-transparent`
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default function Checklist() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [checklist, setChecklist] = useState(initialChecklist())
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [pdfUrls, setPdfUrls] = useState({ checklist: null, cert: null })
  const [error, setError] = useState('')

  const isFormValid =
    form.doctorName.trim() &&
    form.clinicName.trim() &&
    form.trainingDate &&
    form.bdmName.trim() &&
    form.supportMember.trim()

  const yesCount = Object.values(checklist).filter((v) => v === 'Yes').length

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setStatus('submitting')
    setError('')

    try {
      const submission = {
        ...form,
        checklist,
        submittedAt: new Date().toISOString(),
      }

      // Save data
      if (isFirebaseConfigured && db) {
        await addDoc(collection(db, 'submissions'), submission)
      } else {
        const existing = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
        existing.unshift({ ...submission, id: Date.now().toString() })
        localStorage.setItem('tc_submissions', JSON.stringify(existing))
      }

      // Generate PDFs
      const checklistDoc = generateChecklistReport(submission)
      const certDoc = generateCertificate(submission)

      const checklistBlob = checklistDoc.output('blob')
      const certBlob = certDoc.output('blob')

      setPdfUrls({
        checklist: URL.createObjectURL(checklistBlob),
        cert: URL.createObjectURL(certBlob),
      })

      setStatus('success')
    } catch (err) {
      console.error('Submission error:', err)
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setForm(initialForm)
    setChecklist(initialChecklist())
    setPdfUrls({ checklist: null, cert: null })
    setStatus('idle')
    setError('')
  }

  // ── Success Screen ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Submission Successful!</h2>
          <p className="text-slate-500 text-sm mb-1">
            <span className="font-semibold text-slate-700">{form.doctorName}</span> from{' '}
            <span className="font-semibold text-slate-700">{form.clinicName}</span>
          </p>
          <p className="text-slate-400 text-xs mb-7">
            {yesCount} module{yesCount !== 1 ? 's' : ''} marked as completed
          </p>

          <div className="space-y-3 mb-7">
            <a
              href={pdfUrls.checklist}
              download={`Training_Checklist_${form.doctorName.replace(/\s+/g, '_')}.pdf`}
              className="flex items-center justify-between w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-blue-800">Training Checklist Report</p>
                  <p className="text-xs text-blue-500">Full details with Yes / No / NA</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>

            <a
              href={pdfUrls.cert}
              download={`Training_Certificate_${form.doctorName.replace(/\s+/g, '_')}.pdf`}
              className="flex items-center justify-between w-full bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-green-800">Training Certificate</p>
                  <p className="text-xs text-green-500">Only YES modules listed</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 btn-primary text-sm py-2.5">
              Submit Another
            </button>
            <button onClick={() => navigate('/')} className="flex-1 btn-secondary text-sm py-2.5">
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Checklist Form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header */}
      <div className="bg-blue-800 shadow">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-blue-200 hover:text-white transition-colors"
            title="Back to Home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">Training Completion Checklist</h1>
            <p className="text-blue-200 text-xs">Fill all fields and mark each module status</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Training Details */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Training Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Doctor Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. Priya Sharma"
                value={form.doctorName}
                onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Clinic Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sunshine Medical Center"
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Training Completion Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="form-input"
                value={form.trainingDate}
                onChange={(e) => setForm({ ...form, trainingDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">BDM Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Business Development Manager"
                value={form.bdmName}
                onChange={(e) => setForm({ ...form, bdmName: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Support Team Member Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Support team member who conducted the training"
                value={form.supportMember}
                onChange={(e) => setForm({ ...form, supportMember: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* Module Checklist */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Module Training Status
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                <span className="text-slate-500">Yes ({Object.values(checklist).filter(v => v === 'Yes').length})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                <span className="text-slate-500">No ({Object.values(checklist).filter(v => v === 'No').length})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                <span className="text-slate-500">NA ({Object.values(checklist).filter(v => v === 'NA').length})</span>
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>Module</span>
              <span className="pr-2">Status</span>
            </div>
            {CHECKLIST_ITEMS.map((item, i) => (
              <div
                key={item}
                className={`grid grid-cols-[1fr_auto] items-center px-4 py-3 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                } ${i < CHECKLIST_ITEMS.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <span className="text-sm text-slate-700 font-medium">{item}</span>
                <StatusToggle
                  value={checklist[item]}
                  onChange={(v) => setChecklist({ ...checklist, [item]: v })}
                />
              </div>
            ))}
          </div>

          {yesCount === 0 && (
            <p className="text-amber-600 text-xs mt-3 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              No modules marked as Yes — the certificate will have no completed modules listed.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pb-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isFormValid || status === 'submitting'}
            className="btn-primary flex items-center gap-2"
          >
            {status === 'submitting' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Submit &amp; Generate PDFs
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
