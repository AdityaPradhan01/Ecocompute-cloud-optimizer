import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { zoneLabel, n0, n1 } from '../theme';

const INK = [18, 18, 17];
const MUTED = [107, 107, 102];

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

// Builds and downloads a real, multi-page PDF from the fleet's live state —
// not a placeholder. Section inclusion mirrors the Reports screen checklist.
export function generateReportPdf({ period, periodSlug, sections, resources, recommendations, analytics, settings, auditRows }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totalCost = resources.reduce((a, r) => a + (r.costINR || 0), 0);
  const totalCarbon = resources.reduce((a, r) => a + (r.carbonKg || 0), 0);
  const totalEnergy = resources.reduce((a, r) => a + (r.energyKWh || 0), 0);

  let firstPage = true;
  const newPage = () => { if (!firstPage) doc.addPage(); firstPage = false; };

  if (sections.exec) {
    newPage();
    addHeader(doc, 'Executive summary', `Reporting period: ${period}`);
    autoTable(doc, {
      startY: 48,
      head: [['Metric', 'Value']],
      body: [
        ['Instances in fleet', String(resources.length)],
        ['Monthly energy footprint', `${n0(totalEnergy)} kWh`],
        ['Monthly carbon footprint', `${n1(totalCarbon)} kg CO₂`],
        ['Monthly operations cost', `₹${n0(totalCost)}`],
        analytics ? ['Identified monthly savings', `₹${n0(analytics.summary?.monthlySavings)}`] : null,
        analytics ? ['Projected annual savings', `₹${n0(analytics.summary?.annualSavings)}`] : null,
        analytics ? ['Carbon abatement capacity', `${n1(analytics.summary?.carbonSaved)} kg CO₂`] : null
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
        const wrapped = doc.splitTextToSize(`• ${line}`, 182);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 5 + 2;
      });
    }
  }

  if (sections.ledger) {
    newPage();
    addHeader(doc, 'Carbon ledger', 'Approximate grid carbon intensity per AWS region (editable in Settings)');
    autoTable(doc, {
      startY: 48,
      head: [['Region', 'gCO₂/kWh (approx.)']],
      body: Object.entries(settings.gridFactors).map(([id, factor]) => [
        zoneLabel(id), String(factor)
      ]),
      theme: 'grid',
      headStyles: { fillColor: INK, textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9.5 }
    });
    let y = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Per-instance carbon', 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Instance', 'Region', 'kWh/mo', 'kg CO₂/mo']],
      body: resources.map((r) => [r.serverName, zoneLabel(r.region), n0(r.energyKWh), n1(r.carbonKg)]),
      theme: 'striped',
      headStyles: { fillColor: INK, textColor: 255 },
      styles: { font: 'helvetica', fontSize: 9 }
    });
  }

  if (sections.register) {
    newPage();
    addHeader(doc, 'Instance register', `${resources.length} instances`);
    autoTable(doc, {
      startY: 48,
      head: [['Instance', 'Region', 'Env', 'CPU %', 'Class', 'kWh/mo', 'kg CO₂', '₹/mo']],
      body: resources.map((r) => [
        r.serverName, zoneLabel(r.region), r.environment, `${r.cpuUtilization}%`,
        r.classification, n0(r.energyKWh), n1(r.carbonKg), n0(r.costINR)
      ]),
      theme: 'striped',
      headStyles: { fillColor: INK, textColor: 255 },
      styles: { font: 'helvetica', fontSize: 8.5 }
    });
  }

  if (sections.roadmap && recommendations) {
    newPage();
    addHeader(doc, 'Optimization roadmap', 'Ranked by rupee yield');
    autoTable(doc, {
      startY: 48,
      head: [['Instance', 'Region', 'Current ₹', 'Recommendation', 'Yield']],
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

  if (sections.method) {
    newPage();
    addHeader(doc, 'Methodology and grid sources');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = [
      `Energy (kWh/mo) = (TDP watts × 730 hours × CPU utilization%) ÷ 100000`,
      `Carbon (kg CO₂/mo) = (Energy kWh × PUE × grid factor gCO₂/kWh) ÷ 1000`,
      `Cost (₹/mo) = hourly rate × 730 hours`,
      `Data-centre PUE currently in use: ${settings.pue}`,
      `Classification thresholds: Idle < ${settings.idleBelow}% · Underutilized < ${settings.underutilizedBelow}% · Optimal ≤ ${settings.overloadedAbove}% · Overloaded above that`,
      '',
      'Region model: real AWS regions. Grid carbon factors are approximate',
      'country-level averages, editable in Settings — override with your own',
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
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`ecocompute-${periodSlug}-report.pdf · page ${i} of ${pageCount}`, 14, 290);
  }

  const filename = `ecocompute-${periodSlug}-report.pdf`;
  doc.save(filename);
  return { filename, pageCount };
}
