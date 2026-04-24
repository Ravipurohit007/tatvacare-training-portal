import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return dateString || '' }
}

const drLabel = (name) =>
  name && name.toLowerCase().startsWith('dr') ? name : `Dr. ${name || ''}`

// ─── Training Checklist Report (A4 Portrait) ─────────────────────────────────
export const generateChecklistReport = (submission) => {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const W = 210

  // Header bar
  doc.setFillColor(67, 45, 133)
  doc.rect(0, 0, W, 38, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('TatvaCare', 14, 13)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Healthcare Technology Solutions', 14, 21)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Training Completion Report', W / 2, 13, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, W - 14, 26, { align: 'right' })
  doc.setFontSize(7.5)
  doc.text('Support: +91-9974042363  |  support@tatvacare.in', W / 2, 35, { align: 'center' })

  // Training Details table
  doc.setTextColor(112, 59, 150)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Training Details', 14, 53)
  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  doc.line(14, 55, W - 14, 55)

  const location = [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ')

  autoTable(doc, {
    startY: 58,
    body: [
      ['Doctor Name',               submission.doctorName || '—'],
      ['Doctor Phone',              submission.doctorPhone || '—'],
      ['City / State',              location || '—'],
      ['Complete Address',          submission.completeAddress || '—'],
      ['Clinic Name',               submission.clinicName || '—'],
      ['Clinic Type',               submission.clinicType || '—'],
      ['No. of Staff',              submission.noOfStaff || '—'],
      ['Frontdesk / Receptionist',  submission.frontdeskNumber || '—'],
      ['Receptionist Name',         submission.receptionistName || '—'],
      ['Onboarding Date',           submission.onboardingDate ? formatDate(submission.onboardingDate) : '—'],
      ['Training Date',             submission.trainingDate ? formatDate(submission.trainingDate) : '—'],
      ['BDM Name',                  submission.bdmName || '—'],
      ['BDM Phone',                 submission.bdmPhone || '—'],
      ['AM Name',                   submission.amName || '—'],
      ['Device Details',            submission.deviceDetails || '—'],
      ['Internet Type',             submission.internetType || '—'],
    ],
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: [71, 85, 105] },
      1: { textColor: [15, 23, 42] },
    },
    margin: { left: 14, right: 14 },
  })

  // Module Status (Yes & No only)
  const detailsEnd = doc.lastAutoTable.finalY + 8
  doc.setTextColor(112, 59, 150)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Module Training Status', 14, detailsEnd)
  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  doc.line(14, detailsEnd + 2, W - 14, detailsEnd + 2)

  const checklistRows = Object.entries(submission.checklist || {})
    .filter(([, s]) => s !== 'NA')
    .map(([module, s]) => [module, s])

  if (checklistRows.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('No modules marked as Yes or No.', 14, detailsEnd + 12)
  } else {
    autoTable(doc, {
      startY: detailsEnd + 6,
      head: [['Module', 'Status']],
      body: checklistRows,
      theme: 'striped',
      headStyles: { fillColor: [67, 45, 133], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 30, halign: 'center' } },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const v = data.cell.text[0]
          if (v === 'Yes') { data.cell.styles.textColor = [21, 128, 61]; data.cell.styles.fontStyle = 'bold' }
          else if (v === 'No') { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = 'bold' }
        }
      },
      margin: { left: 14, right: 14 },
    })
  }

  let nextY = checklistRows.length === 0 ? detailsEnd + 20 : doc.lastAutoTable.finalY + 8

  // Comments
  const hasComments = submission.supportComment || submission.additionalComments
  if (hasComments) {
    if (nextY > 250) { doc.addPage(); nextY = 20 }
    doc.setTextColor(112, 59, 150)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Comments', 14, nextY)
    doc.setDrawColor(112, 59, 150)
    doc.setLineWidth(0.5)
    doc.line(14, nextY + 2, W - 14, nextY + 2)
    nextY += 8

    if (submission.supportComment) {
      const c = submission.handoverStatus === 'approved' ? [21, 128, 61] : [185, 28, 28]
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...c)
      const label = submission.handoverStatus === 'approved' ? 'Support Approval Note' : 'Support Rejection Reason'
      doc.text(`${label}:`, 14, nextY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const lines = doc.splitTextToSize(submission.supportComment, W - 28)
      doc.text(lines, 14, nextY + 6)
      nextY += 6 + lines.length * 6 + 6
    }

    if (submission.additionalComments) {
      if (nextY > 260) { doc.addPage(); nextY = 20 }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 85, 105)
      doc.text('Additional Comments:', 14, nextY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const lines = doc.splitTextToSize(submission.additionalComments, W - 28)
      doc.text(lines, 14, nextY + 6)
      nextY += 6 + lines.length * 6 + 6
    }
  }

  // ── Doctor's Acknowledgment ───────────────────────────────────────────────
  if (nextY > 220) { doc.addPage(); nextY = 20 }

  const ackY = nextY + 6
  const ackBoxH = 36

  doc.setFillColor(245, 238, 250)
  doc.setDrawColor(184, 127, 220)
  doc.setLineWidth(0.4)
  doc.roundedRect(14, ackY, W - 28, ackBoxH, 2, 2, 'FD')

  doc.setTextColor(112, 59, 150)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text("Doctor's Acknowledgment", 20, ackY + 7)

  const ackText =
    `I, ${drLabel(submission.doctorName)}, hereby confirm that I have completed the training on TatvaPractice EMR software. ` +
    `I have received training on all the modules listed above (checked as "Yes") and have understood the ` +
    `functionalities of the software. I acknowledge that I can request further assistance or support if required.`

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 20, 60)
  const ackLines = doc.splitTextToSize(ackText, W - 36)
  doc.text(ackLines, 20, ackY + 14)

  const sigInBoxY = ackY + ackBoxH - 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 20, 60)
  doc.text('\u2022  Doctor\'s Signature:', 20, sigInBoxY)
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.3)
  doc.line(66, sigInBoxY, 118, sigInBoxY)
  doc.text('\u2022  Date:', 122, sigInBoxY)
  doc.line(134, sigInBoxY, W - 15, sigInBoxY)

  // Bottom Signatures (BDM | Area Manager)
  const bottomSigY = ackY + ackBoxH + 12
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(20,  bottomSigY, 85,  bottomSigY)
  doc.line(125, bottomSigY, 190, bottomSigY)
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')
  doc.text(submission.bdmName || '', 52,  bottomSigY + 5,  { align: 'center' })
  doc.text('BDM',                    52,  bottomSigY + 10, { align: 'center' })
  doc.text(submission.amName  || '', 157, bottomSigY + 5,  { align: 'center' })
  doc.text('Area Manager',           157, bottomSigY + 10, { align: 'center' })



  return doc
}

// ─── Training Certificate (A4 Landscape) ─────────────────────────────────────
export const generateCertificate = (submission) => {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const W = 297
  const H = 210

  doc.setFillColor(254, 252, 243)
  doc.rect(0, 0, W, H, 'F')

  // Double border
  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(3)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.8)
  doc.setDrawColor(184, 127, 220)
  doc.rect(12, 12, W - 24, H - 24)

  // Header bar
  doc.setFillColor(67, 45, 133)
  doc.rect(8, 8, W - 16, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('TatvaCare', W / 2, 19, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Healthcare Technology Solutions', W / 2, 26, { align: 'center' })

  // Title
  doc.setTextColor(112, 59, 150)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICATE OF TRAINING COMPLETION', W / 2, 47, { align: 'center' })

  // Gold divider
  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(1)
  doc.line(W / 2 - 85, 51, W / 2 + 85, 51)

  // Doctor name
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', W / 2, 60, { align: 'center' })

  const dLabel = drLabel(submission.doctorName)
  doc.setTextColor(112, 59, 150)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(dLabel, W / 2, 71, { align: 'center' })

  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  const nameW = (doc.getStringUnitWidth(dLabel) * 20) / doc.internal.scaleFactor
  doc.line(W / 2 - nameW / 2, 74, W / 2 + nameW / 2, 74)

  // Clinic + location + receptionist
  const location = [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ')
  const clinicLine = location ? `${submission.clinicName}, ${location}` : submission.clinicName
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`of  ${clinicLine}`, W / 2, 82, { align: 'center' })

  let nextTextY = 88
  if (submission.receptionistName) {
    doc.setFontSize(9)
    doc.setTextColor(100, 70, 140)
    doc.text(`Receptionist: ${submission.receptionistName}`, W / 2, nextTextY, { align: 'center' })
    nextTextY = 94
  }

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('has successfully completed training on the following TatvaPractice modules:', W / 2, nextTextY, { align: 'center' })

  // YES modules grid
  const yesModules = Object.entries(submission.checklist || {})
    .filter(([, v]) => v === 'Yes').map(([k]) => k)

  const GRID_Y = nextTextY + 7
  const ROW_H = 7
  const COLS = 4
  const moduleRows = yesModules.length === 0 ? 1 : Math.ceil(yesModules.length / COLS)

  if (yesModules.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text('(No modules marked as completed)', W / 2, GRID_Y + 5, { align: 'center' })
  } else {
    const colW = (W - 60) / COLS
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(21, 128, 61)
    yesModules.forEach((mod, i) => {
      const cx = 30 + (i % COLS) * colW + colW / 2
      const cy = GRID_Y + Math.floor(i / COLS) * ROW_H
      doc.text(`\u2713  ${mod}`, cx, cy, { align: 'center' })
    })
  }

  // Training date
  const afterGridY = GRID_Y + moduleRows * ROW_H + 6
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Training Completed on: ${formatDate(submission.trainingDate)}`, W / 2, afterGridY, { align: 'center' })

  // Bottom signature row
  const bottomSigY = afterGridY + 18

  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(W / 3 - 40, bottomSigY, W / 3 + 40, bottomSigY)
  doc.line(2 * W / 3 - 40, bottomSigY, 2 * W / 3 + 40, bottomSigY)

  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')
  doc.text('Head of Product Support', W / 3,     bottomSigY + 10, { align: 'center' })
  doc.text('Head of Sales',           2 * W / 3, bottomSigY + 10, { align: 'center' })

  // Contact info footer
  doc.setFontSize(8)
  doc.setTextColor(112, 59, 150)
  doc.text('Support: +91-9974042363  |  support@tatvacare.in', W / 2, H - 18, { align: 'center' })



  return doc
}
