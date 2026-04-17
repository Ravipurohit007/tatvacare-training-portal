import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../lib/firebase'
import { CHECKLIST_ITEMS, STATUS_COLORS } from '../lib/constants'
import { generateChecklistReport } from '../lib/pdfGenerator'

const initialChecklist = () =>
  Object.fromEntries(CHECKLIST_ITEMS.map((item) => [item, 'NA']))

const initialForm = {
  doctorName: '',
  doctorPhone: '',
  doctorCity: '',
  doctorState: '',
  completeAddress: '',
  clinicName: '',
  clinicType: '',
  noOfStaff: '',
  frontdeskNumber: '',
  receptionistName: '',
  onboardingDate: '',
  trainingDate: '',
  bdmName: '',
  bdmPhone: '',
  amName: '',
  supportMember: '',
  deviceDetails: '',
  internetType: '',
}

const onlyDigits = (e) => {
  if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
  }
}

function PhoneInput({ label, required, value, onChange, error }) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={10}
        className={`form-input ${error ? 'border-red-400' : ''}`}
        placeholder="10-digit number"
        value={value}
        onKeyDown={onlyDigits}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function SelectInput({ label, required, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <select
        className={`form-input ${!value ? 'text-slate-400' : 'text-slate-800'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
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
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [pdfUrl, setPdfUrl] = useState(null)
  const [error, setError] = useState('')

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }))

  // ── Validation ────────────────────────────────────────────────────────────────
  const doctorPhoneErr = form.doctorPhone && !/^\d{10}$/.test(form.doctorPhone)
    ? 'Must be exactly 10 digits' : ''
  const frontdeskErr = form.frontdeskNumber && !/^\d{10}$/.test(form.frontdeskNumber)
    ? 'Must be exactly 10 digits' : ''
  const bdmPhoneErr = form.bdmPhone && !/^\d{10}$/.test(form.bdmPhone)
    ? 'Must be exactly 10 digits' : ''

  const dateGapErr = (() => {
    if (!form.onboardingDate || !form.trainingDate) return ''
    const diff = (new Date(form.trainingDate) - new Date(form.onboardingDate)) / 86400000
    if (diff < 3) return `Training date must be at least 3 days after onboarding date`
    return ''
  })()

  const isFormValid = !!(
    form.doctorName.trim() &&
    form.clinicName.trim() &&
    form.clinicType &&
    form.onboardingDate &&
    form.trainingDate &&
    form.bdmName.trim() &&
    form.amName.trim() &&
    form.supportMember.trim() &&
    !doctorPhoneErr && !frontdeskErr && !bdmPhoneErr && !dateGapErr
  )

  const yesCount = Object.values(checklist).filter((v) => v === 'Yes').length

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isFormValid) return
    setSubmitStatus('submitting')
    setError('')

    const submission = {
      ...form,
      checklist,
      additionalComments,
      handoverStatus: 'pending',
      submittedAt: new Date().toISOString(),
    }

    // Generate checklist report PDF
    try {
      const doc = generateChecklistReport(submission)
      setPdfUrl(URL.createObjectURL(doc.output('blob')))
    } catch (pdfErr) {
      console.error('PDF error:', pdfErr)
      setError('Failed to generate PDF. Please try again.')
      setSubmitStatus('error')
      return
    }

    // Save to Firebase (primary); localStorage as fallback
    if (isFirebaseConfigured && db) {
      try {
        await Promise.race([
          addDoc(collection(db, 'submissions'), submission),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ])
      } catch (e) {
        console.error('Firebase save failed, storing locally:', e)
        const existing = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
        existing.unshift({ ...submission, id: Date.now().toString() })
        localStorage.setItem('tc_submissions', JSON.stringify(existing))
      }
    } else {
      const existing = JSON.parse(localStorage.getItem('tc_submissions') || '[]')
      existing.unshift({ ...submission, id: Date.now().toString() })
      localStorage.setItem('tc_submissions', JSON.stringify(existing))
    }

    setSubmitStatus('success')
  }

  const handleReset = () => {
    setForm(initialForm)
    setChecklist(initialChecklist())
    setAdditionalComments('')
    setPdfUrl(null)
    setSubmitStatus('idle')
    setError('')
  }

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (submitStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(135deg, #f5eefa 0%, #f8f4ff 50%, #eef2ff 100%)' }}>
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-amber-100">
            <svg className="w-9 h-9 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <span className="inline-block px-4 py-1 rounded-full text-sm font-bold mb-3 bg-amber-100 text-amber-700">
            Pending Support Review
          </span>

          <h2 className="text-xl font-bold text-slate-800 mb-1">Submitted!</h2>
          <p className="text-slate-500 text-sm mb-1">
            <span className="font-semibold text-slate-700">{form.doctorName}</span> — {form.clinicName}
          </p>
          <p className="text-slate-400 text-xs mb-7">
            {yesCount} module{yesCount !== 1 ? 's' : ''} completed · awaiting Support team review
          </p>

          <div className="mb-7">
            <a
              href={pdfUrl}
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
                  <p className="text-xs" style={{ color: '#9e54cc' }}>Download for your records</p>
                </div>
              </div>
              <svg className="w-5 h-5" style={{ color: '#703b96' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-purple-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-lg">Training Completion Checklist</h1>
            <p className="text-purple-200 text-xs">Fill all required fields, mark module status, then submit for review</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">

        {/* ── Section 1: Training Details ── */}
        <div className="card p-6">
          <h2 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#703b96' }}>1</span>
            Training Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Doctor & Clinic */}
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Doctor &amp; Clinic Info</p>
            </div>

            <div>
              <label className="form-label">Doctor Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Dr. Priya Sharma"
                value={form.doctorName} onChange={(e) => set('doctorName')(e.target.value)} />
            </div>
            <PhoneInput label="Doctor Phone Number" value={form.doctorPhone}
              onChange={set('doctorPhone')} error={doctorPhoneErr} />

            <div>
              <label className="form-label">City</label>
              <input type="text" className="form-input" placeholder="e.g. Mumbai"
                value={form.doctorCity} onChange={(e) => set('doctorCity')(e.target.value)} />
            </div>
            <div>
              <label className="form-label">State</label>
              <input type="text" className="form-input" placeholder="e.g. Maharashtra"
                value={form.doctorState} onChange={(e) => set('doctorState')(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <label className="form-label">Complete Address</label>
              <textarea className="form-input resize-none" rows={2}
                placeholder="Full clinic address…"
                value={form.completeAddress} onChange={(e) => set('completeAddress')(e.target.value)} />
            </div>

            <div>
              <label className="form-label">Clinic Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="e.g. Sunshine Medical Center"
                value={form.clinicName} onChange={(e) => set('clinicName')(e.target.value)} />
            </div>
            <SelectInput label="Clinic Type" required value={form.clinicType} onChange={set('clinicType')}
              options={['Multi Specialty', 'Hospital', 'Individual Practice']}
              placeholder="Select clinic type…" />

            <div>
              <label className="form-label">No. of Staff</label>
              <input type="number" className="form-input" placeholder="e.g. 5"
                value={form.noOfStaff} onChange={(e) => set('noOfStaff')(e.target.value)} />
            </div>
            <PhoneInput label="Frontdesk / Receptionist Number" value={form.frontdeskNumber}
              onChange={set('frontdeskNumber')} error={frontdeskErr} />

            <div>
              <label className="form-label">Receptionist Name</label>
              <input type="text" className="form-input" placeholder="e.g. Sunita Patel"
                value={form.receptionistName} onChange={(e) => set('receptionistName')(e.target.value)} />
            </div>
            <div /> {/* spacer */}

            <div>
              <label className="form-label">Onboarding Date <span className="text-red-500">*</span></label>
              <input type="date" className="form-input"
                value={form.onboardingDate} onChange={(e) => set('onboardingDate')(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Training Completion Date <span className="text-red-500">*</span></label>
              <input type="date" className={`form-input ${dateGapErr ? 'border-red-400' : ''}`}
                value={form.trainingDate} onChange={(e) => set('trainingDate')(e.target.value)} />
              {dateGapErr && <p className="text-red-500 text-xs mt-1">{dateGapErr}</p>}
            </div>

            {/* TatvaCare Team */}
            <div className="sm:col-span-2 mt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">TatvaCare Team</p>
            </div>

            <div>
              <label className="form-label">BDM Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="BDM who conducted the training"
                value={form.bdmName} onChange={(e) => set('bdmName')(e.target.value)} />
            </div>
            <PhoneInput label="BDM Phone Number" value={form.bdmPhone}
              onChange={set('bdmPhone')} error={bdmPhoneErr} />

            <div>
              <label className="form-label">AM Name <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="Account Manager"
                value={form.amName} onChange={(e) => set('amName')(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Support Team Member <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" placeholder="Support member for this doctor"
                value={form.supportMember} onChange={(e) => set('supportMember')(e.target.value)} />
            </div>

            <SelectInput label="Device Details" value={form.deviceDetails} onChange={set('deviceDetails')}
              options={['Tablet', 'Mobile', 'Laptop', 'Desktop']} placeholder="Select device…" />
            <SelectInput label="Internet Type" value={form.internetType} onChange={set('internetType')}
              options={['Broadband', 'Mobile']} placeholder="Select internet type…" />
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
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-slate-500">Yes ({Object.values(checklist).filter(v => v === 'Yes').length})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                <span className="text-slate-500">No ({Object.values(checklist).filter(v => v === 'No').length})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
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
                className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} ${i < CHECKLIST_ITEMS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 font-medium">{i + 1}.</span>
                  <span className="text-sm text-slate-700 font-medium">{item}</span>
                </div>
                <StatusToggle value={checklist[item]} onChange={(v) => setChecklist({ ...checklist, [item]: v })} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 3: Additional Comments ── */}
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Submit */}
        <div className="flex flex-wrap items-center gap-3 justify-between pb-6">
          <button type="button" onClick={() => navigate('/')} className="btn-secondary">Cancel</button>
          <button
            type="button"
            disabled={!isFormValid || submitStatus === 'submitting'}
            onClick={handleSubmit}
            className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
            style={{ background: isFormValid ? 'linear-gradient(90deg,#432d85,#703b96)' : '#94a3b8' }}
          >
            {submitStatus === 'submitting' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit for Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
