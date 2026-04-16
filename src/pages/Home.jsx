import { useNavigate } from 'react-router-dom'
import { isFirebaseConfigured } from '../lib/firebase'

const SOP_URL = import.meta.env.VITE_SOP_URL || ''

export default function Home() {
  const navigate = useNavigate()

  const handleSOP = () => {
    if (SOP_URL) {
      window.open(SOP_URL, '_blank', 'noopener,noreferrer')
    } else {
      alert(
        'SOP URL not configured.\n\nAdd VITE_SOP_URL to your .env file to link your SOP document.'
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Navbar */}
      <nav className="bg-blue-800 shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-800 font-black text-lg leading-none">T</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">TatvaCare</p>
              <p className="text-blue-200 text-xs">Healthcare Technology</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="text-blue-200 hover:text-white text-sm flex items-center gap-1 transition-colors"
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
              Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to <code className="bg-amber-100 px-1 rounded">.env</code> and add your Firebase credentials.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold text-slate-800 mb-3">
          Training &amp; Handover Portal
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Complete training documentation, generate certificates, and maintain handover records for all clinic onboardings.
        </p>
      </div>

      {/* Main Cards */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* SOP Card */}
          <button
            onClick={handleSOP}
            className="card p-8 text-left hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
              <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">SOP Document</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-5">
              Standard Operating Procedure for training and onboarding. Reference this document before conducting any clinic training session.
            </p>
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold text-sm group-hover:gap-2.5 transition-all">
              Open Document
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </button>

          {/* Checklist Card */}
          <button
            onClick={() => navigate('/checklist')}
            className="card p-8 text-left hover:shadow-md hover:border-blue-200 transition-all group bg-blue-800 border-blue-800"
          >
            <div className="w-14 h-14 bg-blue-700 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Training Completion Checklist</h2>
            <p className="text-blue-200 text-sm leading-relaxed mb-5">
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
              <p className="text-2xl font-bold text-blue-800">18</p>
              <p className="text-slate-500 text-xs mt-0.5">Modules Covered</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-blue-800">2</p>
              <p className="text-slate-500 text-xs mt-0.5">PDFs Generated</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-blue-800">1</p>
              <p className="text-slate-500 text-xs mt-0.5">Click Submission</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
