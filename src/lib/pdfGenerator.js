import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

// ─── Training Checklist Report (A4 Portrait) ─────────────────────────────────
export const generateChecklistReport = (submission) => {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const W = 210

  // Header bar
  doc.setFillColor(30, 64, 175)
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

  // Section: Training Details
  doc.setTextColor(30, 64, 175)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Training Details', 14, 44)

  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(0.5)
  doc.line(14, 46, W - 14, 46)

  autoTable(doc, {
    startY: 50,
    body: [
      ['Doctor Name',          submission.doctorName],
      ['Clinic Name',          submission.clinicName],
      ['Training Date',        formatDate(submission.trainingDate)],
      ['BDM Name',             submission.bdmName],
      ['Support Team Member',  submission.supportMember],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60, textColor: [71, 85, 105] },
      1: { textColor: [15, 23, 42] },
    },
    margin: { left: 14, right: 14 },
  })

  // Section: Module Checklist
  const detailsEnd = doc.lastAutoTable.finalY + 10

  doc.setTextColor(30, 64, 175)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Module Training Status', 14, detailsEnd)

  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(0.5)
  doc.line(14, detailsEnd + 2, W - 14, detailsEnd + 2)

  const checklistRows = Object.entries(submission.checklist).map(
    ([module, status]) => [module, status]
  )

  autoTable(doc, {
    startY: detailsEnd + 6,
    head: [['Module', 'Status']],
    body: checklistRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 30, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const v = data.cell.text[0]
        if (v === 'Yes') {
          data.cell.styles.textColor = [21, 128, 61]
          data.cell.styles.fontStyle = 'bold'
        } else if (v === 'No') {
          data.cell.styles.textColor = [185, 28, 28]
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [100, 116, 139]
        }
      }
    },
    margin: { left: 14, right: 14 },
  })

  // Signature area
  const sigY = doc.lastAutoTable.finalY + 18

  if (sigY < 265) {
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

  // Cream background
  doc.setFillColor(254, 252, 243)
  doc.rect(0, 0, W, H, 'F')

  // Outer border
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(3)
  doc.rect(8, 8, W - 16, H - 16)

  // Inner border
  doc.setLineWidth(0.8)
  doc.setDrawColor(96, 165, 250)
  doc.rect(12, 12, W - 24, H - 24)

  // Blue header bar
  doc.setFillColor(30, 64, 175)
  doc.rect(8, 8, W - 16, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('TatvaCare', W / 2, 19, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Healthcare Technology Solutions', W / 2, 27, { align: 'center' })

  // Certificate title
  doc.setTextColor(30, 64, 175)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTIFICATE OF TRAINING COMPLETION', W / 2, 56, { align: 'center' })

  // Gold divider line
  doc.setDrawColor(202, 138, 4)
  doc.setLineWidth(1.2)
  doc.line(W / 2 - 90, 61, W / 2 + 90, 61)

  // Certify text
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('This is to certify that', W / 2, 74, { align: 'center' })

  // Doctor name
  doc.setTextColor(30, 64, 175)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  const doctorLabel = submission.doctorName.toLowerCase().startsWith('dr')
    ? submission.doctorName
    : `Dr. ${submission.doctorName}`
  doc.text(doctorLabel, W / 2, 87, { align: 'center' })

  // Underline
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(0.5)
  const nameW = (doc.getStringUnitWidth(doctorLabel) * 24) / doc.internal.scaleFactor
  doc.line(W / 2 - nameW / 2, 90, W / 2 + nameW / 2, 90)

  // Clinic & description
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`of  ${submission.clinicName}`, W / 2, 100, { align: 'center' })
  doc.text(
    'has successfully completed training on the following TatvaCare modules:',
    W / 2, 110, { align: 'center' }
  )

  // YES modules grid
  const yesModules = Object.entries(submission.checklist)
    .filter(([, v]) => v === 'Yes')
    .map(([k]) => k)

  if (yesModules.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('(No modules marked as completed)', W / 2, 125, { align: 'center' })
  } else {
    const cols = Math.min(yesModules.length, 4)
    const colW = (W - 80) / cols
    const startX = 40
    const startY = 122

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(21, 128, 61)

    yesModules.forEach((mod, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = startX + col * colW + colW / 2
      const cy = startY + row * 10
      doc.text(`\u2713  ${mod}`, cx, cy, { align: 'center' })
    })
  }

  // Training date
  const moduleRows = yesModules.length === 0 ? 1 : Math.ceil(yesModules.length / 4)
  const dateY = 122 + moduleRows * 10 + 6

  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Training Completed on:  ${formatDate(submission.trainingDate)}`,
    W / 2, dateY, { align: 'center' }
  )

  // Signature lines
  const sigY = H - 28

  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.4)
  doc.line(28, sigY, 95, sigY)
  doc.line(W / 2 - 34, sigY, W / 2 + 34, sigY)
  doc.line(W - 95, sigY, W - 28, sigY)

  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'normal')

  doc.text(submission.bdmName,       61.5,     sigY + 5, { align: 'center' })
  doc.text('Business Development Manager', 61.5, sigY + 10, { align: 'center' })

  doc.text(submission.supportMember, W / 2, sigY + 5,  { align: 'center' })
  doc.text('Support Team',           W / 2, sigY + 10, { align: 'center' })

  doc.text('Authorised Signatory',   W - 61.5, sigY + 5,  { align: 'center' })
  doc.text('TatvaCare',              W - 61.5, sigY + 10, { align: 'center' })

  return doc
}
