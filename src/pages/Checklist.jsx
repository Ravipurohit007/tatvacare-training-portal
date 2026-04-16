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
  doctorPhone: '',
  doctorCity: '',
  doctorState: '',
  clinicName: '',
  noOfStaff: '',
  frontdeskNumber: '',
  onboardingDate: '',
  trainingDate: '',
  bdmName: '',
  amName: '',
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
  const [additionalComments, setAdditionalComments] = useState('')
  const [handoverStatus, setHandoverStatus] = useState('') // '' | 'approved' | 'rejected'
  const [handoverComment, setHandoverComment] = useState('')
  const [submitStatus, setSubmitStatus] = useState('idle') // idle | submitting | success | error
  const [pdfUrls, setPdfUrls] = useState({ checklist: null, cert: null })
  const [error, setError] = useState('')

  const isFormValid =
    form.doctorName.trim() &&
    form.clinicName.trim() &&
    form.trainingDate &&
    form.bdmName.trim() &&
    form.amName.trim() &&
    form.supportMember.trim()

  const yesCount = Object.values(checklist).filter((v) => v === 'Yes').length

  const handleSubmit = (decisionStatus) => {
    if (!isFormValid || !decisionStatus) return
    setSubmitStatus('submitting')
    setError('')

    const submission = {
      ...form,
      checklist,
      additionalComments,
      handoverStatus: decisionStatus,
      handoverComment,
      submittedAt: new Date().toISOString(),
    }

    // Step 1: Generate PDFs (synchronous — no network needed)
    try {
      const checklistDoc = generateChecklistReport(submission)
      const certDoc = generateCertificate(submission)
      setPdfUrls({
        checklist: URL.createObjectURL(checklistDoc.output('blob')),
        cert: URL.createObjectURL(certDoc.output('blob')),
      })
    } catch (pdfErr) {
      console.error('PDF error:', pdfErr)
      setError('Failed to generate PDFs. Please try again.')
      setSubmitStatus('error')
      return
    }

    // Step 2: Save in background — never block the UI
    // Always save to localStorage immediately
    const existing = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
    existing.unshift({ ...submission, id: Date.now().toString() })
    localStorage.setItem('tc_submissions', JSON.stringify(existing))

    // Also push to Firebase in background (fire and forget)
    if (isFirebaseConfigured && db) {
      addDoc(collection(db, 'submissions'), submission).catch((e) =>
        console.error('Firebase save failed (data saved locally):', e)
      )
    }

    // Show success immediately — don't wait for network
    setHandoverStatus(decisionStatus)
    setSubmitStatus('success')
  }

  const handleReset = () => {
    setForm(initialForm)
    setChecklist(initialChecklist())
    setAdditionalComments('')
    setHandoverStatus('')
    setHandoverComment('')
    setPdfUrls({ checklist: null, cert: null })
    setSubmitStatus('idle')
    setError('')
  }

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (submitStatus === 'success') {
    const isApproved = handoverStatus === 'approved'
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
        <div className="card max-w-md w-full p-8 text-center">
          {/* Status icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
            isApproved ? 'bg-green-100' : 'bg-red-100'}`}>
            {isApproved ? (
              <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-9 h-9 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          {/* Status badge */}
          <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-3 ${
            isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Handover {isApproved ? 'Approved' : 'Rejected'}
          </span>

          <h2 className="text-xl font-bold text-slate-800 mb-1">Submission Saved!</h2>
          <p className="text-slate-500 text-sm mb-1">
            <span className="font-semibold text-slate-700">{form.doctorName}</span> — {form.clinicName}
          </p>
          <p className="text-slate-400 text-xs mb-7">
            {yesCount} module{yesCount !== 1 ? 's' : ''} completed
          </p>

          <div className="space-y-3 mb-7">
            <a
              href={pdfUrls.checklist}
              download={`Checklist_${form.doctorName.replace(/\s+/g, '_')}.pdf`}
              className="flex items-center justify-between w-full rounded-lg px-4 py-3 transition-colors"
              style={{ background: '#f5eefa', border: '1px solid #d3b2eb' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e9d8f5'}
              onMouseLeave={e => e.currentTarget.style.background = '#f5eefa'}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e9d8f5' }}>
                  <svg className="w-4 h-4" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: '#432d85' }}>Training Checklist Report</p>
                  <p className="text-xs" style={{ color: '#9e54cc' }}>Yes &amp; No modules · with handover status</p>
                </div>
              </div>
              <svg className="w-5 h-5" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>

            <a
              href={pdfUrls.cert}
              download={`Certificate_${form.doctorName.replace(/\s+/g, '_')}.pdf`}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          </div>

          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 btn-primary text-sm py-2.5">Submit Another</button>
            <button onClick={() => navigate('/')} className="flex-1 btn-secondary text-sm py-2.5">Go Home</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
      {/* Header */}
      <div className="shadow" style={{ background: 'linear-gradient(90deg, #432d85 0%, #703b96 100%)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-purple-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">Training Completion Checklist</h1>
            <p className="text-purple-200 text-xs">Fill all fields, mark module status, then approve or reject handover</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* ── Section 1: Training Details ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#703b96' }}>1</span>
            Training Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Doctor &amp; Clinic Info</p>
            </div>
            <div>
              <label className="form-label">Doctor Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Dr. Priya Sharma"
                value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Doctor Phone Number</label>
              <input type="tel" className="form-input" placeholder="e.g. 9876543210"
                value={form.doctorPhone} onChange={(e) => setForm({ ...form, doctorPhone: e.target.value })} />
            </div>
            <div>
              <label className="form-label">City</label>
              <input type="text" className="form-input" placeholder="e.g. Mumbai"
                value={form.doctorCity} onChange={(e) => setForm({ ...form, doctorCity: e.target.value })} />
            </div>
            <div>
              <label className="form-label">State</label>
              <input type="text" className="form-input" placeholder="e.g. Maharashtra"
                value={form.doctorState} onChange={(e) => setForm({ ...form, doctorState: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Clinic Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Sunshine Medical Center"
                value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">No. of Staff</label>
              <input type="number" className="form-input" placeholder="e.g. 5"
                value={form.noOfStaff} onChange={(e) => setForm({ ...form, noOfStaff: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Frontdesk / Receptionist Number</label>
              <input type="tel" className="form-input" placeholder="e.g. 9876543210"
                value={form.frontdeskNumber} onChange={(e) => setForm({ ...form, frontdeskNumber: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Onboarding Date</label>
              <input type="date" className="form-input"
                value={form.onboardingDate} onChange={(e) => setForm({ ...form, onboardingDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Training Completion Date <span className="text-red-500">*</span></label>
              <input type="date" className="form-input"
                value={form.trainingDate} onChange={(e) => setForm({ ...form, trainingDate: e.target.value })} required />
            </div>

            <div className="sm:col-span-2 mt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">TatvaCare Team</p>
            </div>
            <div>
              <label className="form-label">BDM Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="BDM who conducted the training"
                value={form.bdmName} onChange={(e) => setForm({ ...form, bdmName: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">AM Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="Account Manager (BDM reports to)"
                value={form.amName} onChange={(e) => setForm({ ...form, amName: e.target.value })} required />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Support Team Member Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input"
                placeholder="Support member who will take care of this doctor going forward"
                value={form.supportMember} onChange={(e) => setForm({ ...form, supportMember: e.target.value })} required />
            </div>
          </div>
        </div>

        {/* ── Section 2: Module Checklist ── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#703b96' }}>2</span>
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
              <div key={item}
                className={`grid grid-cols-[1fr_auto] items-center px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} ${i < CHECKLIST_ITEMS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 font-medium">{i + 1}.</span>
                  <span className="text-sm text-slate-700 font-medium">{item}</span>
                </div>
                <StatusToggle value={checklist[item]} onChange={(v) => setChecklist({ ...checklist, [item]: v })} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 3: Comments ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#703b96' }}>3</span>
            Additional Comments
          </h2>
          <textarea
            className="form-input resize-none"
            rows={3}
            placeholder="Any additional notes, observations, or remarks about this training session…"
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
          />
        </div>

        {/* ── Section 4: Handover Decision ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#703b96' }}>4</span>
            Handover Decision
          </h2>
          <p className="text-slate-400 text-xs mb-5">
            Review the checklist above and decide whether to approve or reject this handover.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Approve */}
            <button
              type="button"
              onClick={() => setHandoverStatus(handoverStatus === 'approved' ? '' : 'approved')}
              className={`rounded-xl border-2 p-5 text-left transition-all ${
                handoverStatus === 'approved'
                  ? 'bg-green-50 border-green-500'
                  : 'bg-white border-slate-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  handoverStatus === 'approved' ? 'bg-green-500' : 'bg-slate-100'}`}>
                  <svg className={`w-4 h-4 ${handoverStatus === 'approved' ? 'text-white' : 'text-slate-400'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className={`font-bold text-sm ${handoverStatus === 'approved' ? 'text-green-700' : 'text-slate-600'}`}>
                  Approve Handover
                </span>
              </div>
              <p className="text-xs text-slate-400 pl-11">Training complete. Doctor is ready to use the system.</p>
            </button>

            {/* Reject */}
            <button
              type="button"
              onClick={() => setHandoverStatus(handoverStatus === 'rejected' ? '' : 'rejected')}
              className={`rounded-xl border-2 p-5 text-left transition-all ${
                handoverStatus === 'rejected'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-white border-slate-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  handoverStatus === 'rejected' ? 'bg-red-500' : 'bg-slate-100'}`}>
                  <svg className={`w-4 h-4 ${handoverStatus === 'rejected' ? 'text-white' : 'text-slate-400'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className={`font-bold text-sm ${handoverStatus === 'rejected' ? 'text-red-700' : 'text-slate-600'}`}>
                  Reject Handover
                </span>
              </div>
              <p className="text-xs text-slate-400 pl-11">Training incomplete. Follow-up required before handover.</p>
            </button>
          </div>

          {/* Comment for decision */}
          {handoverStatus && (
            <div className={`rounded-lg p-4 ${handoverStatus === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <label className={`block text-sm font-semibold mb-2 ${handoverStatus === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                {handoverStatus === 'approved' ? 'Approval Comment (optional)' : 'Rejection Reason (optional)'}
              </label>
              <textarea
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                rows={2}
                placeholder={handoverStatus === 'approved'
                  ? 'e.g. Doctor and staff are fully trained. All modules completed successfully.'
                  : 'e.g. Pharmacy module not completed. Re-training required on billing.'}
                value={handoverComment}
                onChange={(e) => setHandoverComment(e.target.value)}
                style={{ '--tw-ring-color': handoverStatus === 'approved' ? '#22c55e' : '#ef4444' }}
                onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${handoverStatus === 'approved' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`}
                onBlur={e => e.target.style.boxShadow = 'none'}
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Submit buttons */}
        <div className="flex items-center justify-between pb-6">
          <button type="button" onClick={() => navigate('/')} className="btn-secondary">Cancel</button>

          <div className="flex gap-3">
            {(!handoverStatus || handoverStatus === 'rejected') && (
              <button
                type="button"
                disabled={!isFormValid || submitStatus === 'submitting'}
                onClick={() => handleSubmit('rejected')}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-5 rounded-lg transition-colors"
              >
                {submitStatus === 'submitting' && handoverStatus === 'rejected' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                Reject &amp; Save
              </button>
            )}
            {(!handoverStatus || handoverStatus === 'approved') && (
              <button
                type="button"
                disabled={!isFormValid || submitStatus === 'submitting'}
                onClick={() => handleSubmit('approved')}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-5 rounded-lg transition-colors"
              >
                {submitStatus === 'submitting' && handoverStatus === 'approved' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Approve &amp; Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
