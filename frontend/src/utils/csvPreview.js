// Real (if naive — no quoted-comma handling) client-side CSV header/sample
// parse used by the Data intake column-map preview, so that table reflects
// the file the user actually chose instead of a static mock.
export const REQUIRED_FIELDS = [
  { header: 'serverName', field: 'Instance name' },
  { header: 'region', field: 'AWS region' },
  { header: 'environment', field: 'Environment' },
  { header: 'cpuUtilization', field: 'CPU %' },
  { header: 'tdp', field: 'Power draw (W)' },
  { header: 'hourlyRate', field: 'Hourly rate (₹)' }
];

export function parseCsvPreview(text) {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
  const headers = lines.length ? lines[0].split(',').map((h) => h.trim()) : [];
  const sampleRow = lines.length > 1 ? lines[1].split(',').map((v) => v.trim()) : [];

  const rows = REQUIRED_FIELDS.map(({ header, field }) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === header.toLowerCase());
    return {
      header,
      field,
      sample: idx > -1 && sampleRow[idx] !== undefined ? sampleRow[idx] : '—',
      ok: idx > -1
    };
  });

  return { rows, matched: rows.filter((r) => r.ok).length, total: rows.length, rowCount: Math.max(0, lines.length - 1) };
}
