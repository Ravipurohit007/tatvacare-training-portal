import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return dateString }
}

// ─── Training Checklist Report (A4 Portrait) ─────────────────────────────────
export const generateChecklistReport = (submission) => {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const W = 210

  // Header bar
  doc.setFillColor(67, 45, 133)
  doc.rect(0, 0, W, 32, 'F')

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

  // Handover status stamp
  const status = submission.handoverStatus
  if (status === 'approved' || status === 'rejected') {
    const stampColor = status === 'approved' ? [21, 128, 61] : [185, 28, 28]
    const stampLabel = status === 'approved' ? 'APPROVED' : 'REJECTED'
    doc.setFillColor(...stampColor)
    doc.roundedRect(W - 56, 36, 42, 12, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(stampLabel, W - 35, 44, { align: 'center' })
  }

  // Section: Training Details
  doc.setTextColor(112, 59, 150)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Training Details', 14, 53)
  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  doc.line(14, 55, W - 14, 55)

  autoTable(doc, {
    startY: 58,
    body: [
      ['Doctor Name',               submission.doctorName],
      ['Doctor Phone',              submission.doctorPhone || '—'],
      ['City / State',              [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ') || '—'],
      ['Clinic Name',               submission.clinicName],
      ['No. of Staff',              submission.noOfStaff || '—'],
      ['Frontdesk / Receptionist',  submission.frontdeskNumber || '—'],
      ['Onboarding Date',           submission.onboardingDate ? formatDate(submission.onboardingDate) : '—'],
      ['Training Date',             formatDate(submission.trainingDate)],
      ['BDM Name',                  submission.bdmName],
      ['AM Name',                   submission.amName || '—'],
      ['Support Team Member',       submission.supportMember],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: [71, 85, 105] },
      1: { textColor: [15, 23, 42] },
    },
    margin: { left: 14, right: 14 },
  })

  // Section: Module Status (Yes & No only)
  const detailsEnd = doc.lastAutoTable.finalY + 8

  doc.setTextColor(112, 59, 150)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Module Training Status', 14, detailsEnd)
  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  doc.line(14, detailsEnd + 2, W - 14, detailsEnd + 2)

  // Filter out NA
  const checklistRows = Object.entries(submission.checklist)
    .filter(([, status]) => status !== 'NA')
    .map(([module, status]) => [module, status])

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
      columnStyles: {
        0: { cellWidth: 140 },
        1: { cellWidth: 30, halign: 'center' },
      },
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

  let nextY = checklistRows.length === 0
    ? detailsEnd + 20
    : doc.lastAutoTable.finalY + 8

  // Comments section
  const hasComments = submission.additionalComments || submission.handoverComment
  if (hasComments) {
    // check if we need new page
    if (nextY > 250) { doc.addPage(); nextY = 20 }

    doc.setTextColor(112, 59, 150)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Comments', 14, nextY)
    doc.setDrawColor(112, 59, 150)
    doc.setLineWidth(0.5)
    doc.line(14, nextY + 2, W - 14, nextY + 2)
    nextY += 8

    if (submission.handoverComment) {
      const stampColor = submission.handoverStatus === 'approved' ? [21, 128, 61] : submission.handoverStatus === 'rejected' ? [185, 28, 28] : [107, 114, 128]
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...stampColor)
      const label = submission.handoverStatus === 'approved' ? 'Approval Comment' : submission.handoverStatus === 'rejected' ? 'Rejection Reason' : 'Decision Comment'
      doc.text(`${label}:`, 14, nextY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 30, 30)
      const lines = doc.splitTextToSize(submission.handoverComment, W - 28)
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

  // Signature area
  const sigY = nextY + 10
  if (sigY < 270) {
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.4)
    doc.line(20, sigY, 85, sigY)
    doc.line(125, sigY, 190, sigY)
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'normal')
    doc.text(submission.bdmName,       52,  sigY + 5, { align: 'center' })
    doc.text('BDM',                    52,  sigY + 10, { align: 'center' })
    doc.text(submission.supportMember, 157, sigY + 5,  { align: 'center' })
    doc.text('Support Team',           157, sigY + 10, { align: 'center' })
  }

  return doc
}

// ─── Training Certificate (A4 Landscape) ─────────────────────────────────────
export const generateCertificate = (submission) => {
  const doc = new jsPDF('landscape', 'mm', 'a4')
  const W = 297
  const H = 210

  doc.setFillColor(254, 252, 243)
  doc.rect(0, 0, W, H, 'F')

  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(3)
  doc.rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.8)
  doc.setDrawColor(184, 127, 220)
  doc.rect(12, 12, W - 24, H - 24)

  doc.setFillColor(67, 45, 133)
  doc.rect(8, 8, W - 16, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('TatvaCare', W / 2, 19, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Healthcare Technology Solutions', W / 2, 27, { align: 'center' })

  doc.setTextColor(112, 59, 150)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICATE OF TRAINING COMPLETION', W / 2, 56, { align: 'center' })

  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(1.2)
  doc.line(W / 2 - 90, 61, W / 2 + 90, 61)

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', W / 2, 74, { align: 'center' })

  doc.setTextColor(112, 59, 150)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  const doctorLabel = submission.doctorName.toLowerCase().startsWith('dr')
    ? submission.doctorName : `Dr. ${submission.doctorName}`
  doc.text(doctorLabel, W / 2, 87, { align: 'center' })

  doc.setDrawColor(112, 59, 150)
  doc.setLineWidth(0.5)
  const nameW = (doc.getStringUnitWidth(doctorLabel) * 24) / doc.internal.scaleFactor
  doc.line(W / 2 - nameW / 2, 90, W / 2 + nameW / 2, 90)

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const location = [submission.doctorCity, submission.doctorState].filter(Boolean).join(', ')
  const clinicLine = location ? `${submission.clinicName}, ${location}` : submission.clinicName
  doc.text(`of  ${clinicLine}`, W / 2, 100, { align: 'center' })
  doc.text('has successfully completed training on the following TatvaCare modules:', W / 2, 110, { align: 'center' })

  const yesModules = Object.entries(submission.checklist)
    .filter(([, v]) => v === 'Yes').map(([k]) => k)

  if (yesModules.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('(No modules marked as completed)', W / 2, 125, { align: 'center' })
  } else {
    const cols = Math.min(yesModules.length, 4)
    const colW = (W - 80) / cols
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(21, 128, 61)
    yesModules.forEach((mod, i) => {
      const cx = 40 + (i % cols) * colW + colW / 2
      const cy = 122 + Math.floor(i / cols) * 10
      doc.text(`\u2713  ${mod}`, cx, cy, { align: 'center' })
    })
  }

  const moduleRows = yesModules.length === 0 ? 1 : Math.ceil(yesModules.length / 4)
  const dateY = 122 + moduleRows * 10 + 6

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Training Completed on:  ${formatDate(submission.trainingDate)}`, W / 2, dateY, { align: 'center' })

  // Acknowledgment text
  const ackY = 122 + moduleRows * 10 + 18

  doc.setFillColor(245, 238, 250)
  doc.roundedRect(20, ackY - 5, W - 40, 16, 2, 2, 'F')
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(67, 45, 133)
  const doctorLabel2 = submission.doctorName.toLowerCase().startsWith('dr')
    ? submission.doctorName : `Dr. ${submission.doctorName}`
  doc.text(
    `"I, ${doctorLabel2}, acknowledge that I have received the training from ${submission.bdmName} on ${formatDate(submission.trainingDate)}."`,
    W / 2, ackY + 4, { align: 'center', maxWidth: W - 50 }
  )

  // Signatures
  const sigY = H - 32

  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)

  // Doctor signature
  doc.line(20, sigY, 78, sigY)
  // BDM signature
  doc.line(W / 2 - 30, sigY, W / 2 + 30, sigY)
  // Support signature
  doc.line(W - 78, sigY, W - 20, sigY)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  const docName2 = submission.doctorName.toLowerCase().startsWith('dr')
    ? submission.doctorName : `Dr. ${submission.doctorName}`
  doc.text(docName2,             49,  sigY + 5, { align: 'center' })
  doc.text('Doctor / Recipient', 49,  sigY + 10, { align: 'center' })

  doc.text(submission.bdmName,   W / 2, sigY + 5,  { align: 'center' })
  doc.text('BDM / Trainer',      W / 2, sigY + 10, { align: 'center' })

  doc.text(submission.supportMember, W - 49, sigY + 5,  { align: 'center' })
  doc.text('Support Team',           W - 49, sigY + 10, { align: 'center' })

  // TatvaCare stamp (bottom right corner)
  const stX = W - 26
  const stY = H - 26
  const stR = 16
  doc.setDrawColor(67, 45, 133)
  doc.setLineWidth(1.5)
  doc.circle(stX, stY, stR)
  doc.setLineWidth(0.5)
  doc.circle(stX, stY, stR - 2.5)

  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(67, 45, 133)
  doc.text('TATVACARE',   stX, stY - 5,  { align: 'center' })
  doc.text('HEALTHCARE',  stX, stY,      { align: 'center' })
  doc.text('TECHNOLOGY',  stX, stY + 5,  { align: 'center' })

  return doc
}
