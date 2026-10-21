// Server-side twin of frontend/src/utils/reportPdf.js - same jsPDF engine,
// same layout conventions, but returns a Buffer instead of triggering a
// browser download, so the scheduler can attach it to an email. Kept
// deliberately fixed-section (exec summary, carbon ledger, roadmap) rather
// than mirroring every checkbox on the Reports screen - an unattended email
// has no one there to pick sections, so it always sends the complete set.
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;
const { zoneLabel } = require('./carbonMath');

const INK = [18, 18, 17];
const MUTED = [107, 107, 102];

const n0 = (v) => Math.round(v || 0).toLocaleString('en-IN');
const n1 = (v) => (Math.round((v || 0) * 10) / 10).toLocaleString('en-IN');

// analytics.aiInsights is free-text from analyticsController.js and can
// contain Rupee/CO2/— characters - the same ones that break jsPDF's built-in
// font elsewhere in this file. One of these mid-sentence doesn't just
// mis-render — it corrupts splitTextToSize's wrap calculation badly enough
// to silently drop the rest of that sentence from the page.
const pdfSafe = (s) => String(s)
  .replace(/CO₂/g, 'CO2')
  .replace(/₹/g, 'Rs. ')
  .replace(/≤/g, '<=')
  .replace(/—/g, '-');

function addHeader(doc, title, subtitle) {
  doc.setFillColor(...INK);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ECOCOMPUTE', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Cloud carbon operations', 14, 17);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 34);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 40);
    doc.setTextColor(0, 0, 0);
  }
}

function buildReportPdfBuffer({ period, resources, recommendations, analytics, settings, auditRows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totalCost = resources.reduce((a, r) => a + (r.costINR || 0), 0);
  const totalCarbon = resources.reduce((a, r) => a + (r.carbonKg || 0), 0);
  const totalEnergy = resources.reduce((a, r) => a + (r.energyKWh || 0), 0);

  let firstPage = true;
  const newPage = () => { if (!firstPage) doc.addPage(); firstPage = false; };

  // Executive summary
  newPage();
  addHeader(doc, 'Executive summary', `Reporting period: ${period} · scheduled delivery`);
  autoTable(doc, {
    startY: 48,
    head: [['Metric', 'Value']],
    body: [
      ['Instances in fleet', String(resources.length)],
      ['Monthly energy footprint', `${n0(totalEnergy)} kWh`],
      ['Monthly carbon footprint', `${n1(totalCarbon)} kg CO2`],
      ['Monthly operations cost', `Rs. ${n0(totalCost)}`],
      analytics ? ['Identified monthly savings', `Rs. ${n0(analytics.summary?.monthlySavings)}`] : null,
      analytics ? ['Projected annual savings', `Rs. ${n0(analytics.summary?.annualSavings)}`] : null,
      analytics ? ['Carbon abatement capacity', `${n1(analytics.summary?.carbonSaved)} kg CO2`] : null
    ].filter(Boolean),
    theme: 'grid',
    headStyles: { fillColor: INK, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 10 }
  });
  if (analytics?.aiInsights?.length) {
    let y = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Insights', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    analytics.aiInsights.forEach((line) => {
      const wrapped = doc.splitTextToSize(`- ${pdfSafe(line)}`, 182);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 5 + 2;
    });
  }

  // Carbon ledger
  newPage();
  addHeader(doc, 'Carbon ledger', 'Approximate grid carbon intensity per AWS region (editable in Settings)');
  autoTable(doc, {
    startY: 48,
    head: [['Region', 'gCO2/kWh (approx.)']],
    body: Object.entries(settings.gridFactors).map(([id, factor]) => [zoneLabel(id), String(factor)]),
    theme: 'grid',
    headStyles: { fillColor: INK, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 9.5 }
  });
  let ledgerY = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Per-instance carbon', 14, ledgerY);
  autoTable(doc, {
    startY: ledgerY + 4,
    head: [['Instance', 'Region', 'kWh/mo', 'kg CO2/mo']],
    body: resources.map((r) => [r.serverName, zoneLabel(r.region), n0(r.energyKWh), n1(r.carbonKg)]),
    theme: 'striped',
    headStyles: { fillColor: INK, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 9 }
  });

  // Optimization roadmap
  if (recommendations?.length) {
    newPage();
    addHeader(doc, 'Optimization roadmap', 'Ranked by rupee yield');
    autoTable(doc, {
      startY: 48,
      head: [['Instance', 'Region', 'Current Rs.', 'Recommendation', 'Yield']],
      body: [...recommendations]
        .sort((a, b) => (b.currentCostINR * b.savingsPercent) - (a.currentCostINR * a.savingsPercent))
        .map((r) => [
          r.serverName, zoneLabel(r.region), n0(r.currentCostINR), r.recommendation,
          r.savingsPercent > 0 ? `-${r.savingsPercent}%` : 'stable'
        ]),
      theme: 'striped',
      headStyles: { fillColor: INK, textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4 && String(data.cell.raw).startsWith('-')) {
          data.cell.styles.textColor = [15, 107, 56];
        }
      }
    });
  }

  // Methodology + recent audit trail
  newPage();
  addHeader(doc, 'Methodology and grid sources');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = [
    `Energy (kWh/mo) = (TDP watts x 730 hours x CPU utilization%) / 100000`,
    `Carbon (kg CO2/mo) = (Energy kWh x PUE x grid factor gCO2/kWh) / 1000`,
    `Cost (Rs./mo) = hourly rate x 730 hours`,
    `Data-centre PUE currently in use: ${settings.pue}`,
    `Classification thresholds: Idle < ${settings.idleBelow}% · Underutilized < ${settings.underutilizedBelow}% · Optimal <= ${settings.overloadedAbove}% · Overloaded above that`,
    '',
    'Region model: real AWS regions. Grid carbon factors are approximate',
    'country-level averages, editable in Settings - override with your own',
    'utility data for compliance-grade reporting.'
  ];
  let y = 48;
  lines.forEach((line) => { doc.text(line, 14, y); y += 6; });

  if (auditRows?.length) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Recent audit trail', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    autoTable(doc, {
      startY: y,
      head: [['Time', 'Event']],
      body: auditRows.map((a) => [a.time, a.text]),
      theme: 'grid',
      headStyles: { fillColor: INK, textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9 }
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`page ${i} of ${pageCount}`, 14, 290);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { buildReportPdfBuffer };
