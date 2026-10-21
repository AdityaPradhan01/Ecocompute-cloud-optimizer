const fs = require('fs');
const { Transform } = require('stream');
const csv = require('csv-parser');
const CloudResource = require('../models/CloudResource');
const {
  calculateEnergy,
  calculateCarbon,
  calculateCost,
  getClassification,
  isKnownRegion
} = require('../utils/carbonMath');
const { logAudit } = require('../utils/audit');

// Excel's "CSV UTF-8" export — the single most common real-world source of
// a spreadsheet dataset — prepends a UTF-8 byte-order mark (EF BB BF) to
// every file. Left in place, it silently glues itself onto the first
// header name ("serverName" becomes "﻿serverName"), so csv-parser's
// very first column never matches and every single row gets rejected as
// "missing required fields" — with no hint that the file is otherwise
// perfectly valid. Stripped here, at the raw byte level, before csv-parser
// ever sees it.
function stripBom() {
  let checked = false;
  return new Transform({
    transform(chunk, encoding, callback) {
      if (!checked) {
        checked = true;
        if (chunk.length >= 3 && chunk[0] === 0xEF && chunk[1] === 0xBB && chunk[2] === 0xBF) {
          chunk = chunk.subarray(3);
        }
      }
      callback(null, chunk);
    }
  });
}

exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No dataset file uploaded." });
  }

  const resultsArray = [];
  const skippedRows = [];
  const filePath = req.file.path;
  let rowNum = 1; // header is row 0
  let responded = false; // csv-parser can fire 'error' after 'end' has already responded — guard against a double response

  // Stream read and validate columns inside incoming dataset rows
  fs.createReadStream(filePath)
    .pipe(stripBom())
    .pipe(csv())
    .on('error', (err) => {
      // A malformed/corrupt upload (binary garbage with a .csv extension,
      // truncated multipart body, etc.) previously had no handler here —
      // the stream would just hang forever with the request never
      // responding, and the temp file never cleaned up. Every malformed
      // upload was a stuck connection + a leaked file on disk.
      console.error('CSV stream error:', err);
      if (responded) return;
      responded = true;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(400).json({ success: false, message: 'Could not parse the uploaded file — make sure it is a valid CSV.' });
    })
    .on('data', (data) => {
      rowNum++;

      // A wholly blank line (trailing newlines at EOF are extremely common
      // in real-world exports) isn't a malformed data row — don't report it
      // as one, which would otherwise look like a real validation failure.
      const isBlankLine = Object.values(data).every((v) => v === undefined || String(v).trim() === '');
      if (isBlankLine) return;

      // Validate required columns are present
      if (!data.serverName || !data.tdp || !data.cpuUtilization || !data.region || !data.hourlyRate) {
        skippedRows.push({ row: rowNum, reason: 'Missing one or more required fields (serverName, tdp, cpuUtilization, region, hourlyRate)' });
        return;
      }

      const tdp = parseFloat(data.tdp);
      const cpu = parseFloat(data.cpuUtilization);
      const rate = parseFloat(data.hourlyRate);
      const region = data.region.toLowerCase().trim();
      const env = (data.environment || 'production').toLowerCase().trim();

      // Validate numeric ranges
      if (isNaN(tdp) || tdp <= 0) {
        skippedRows.push({ row: rowNum, reason: `Invalid tdp value "${data.tdp}" — must be a positive number` });
        return;
      }
      if (isNaN(cpu) || cpu < 0 || cpu > 100) {
        skippedRows.push({ row: rowNum, reason: `Invalid cpuUtilization value "${data.cpuUtilization}" — must be between 0 and 100` });
        return;
      }
      if (isNaN(rate) || rate < 0) {
        skippedRows.push({ row: rowNum, reason: `Invalid hourlyRate value "${data.hourlyRate}" — must be zero or positive` });
        return;
      }
      if (!isKnownRegion(region)) {
        // Not fatal — just flag it, since calculateCarbon will fall back to a default
        skippedRows.push({ row: rowNum, reason: `Unrecognized region "${data.region}" — expected a real AWS region code (e.g. ap-south-1, us-east-1). Row was still processed using the global average carbon intensity`, fatal: false });
      }

      // Evaluate core ecological math utilities
      const energy = calculateEnergy(tdp, cpu);
      const carbon = calculateCarbon(energy, region);
      const cost = calculateCost(rate);
      const classification = getClassification(cpu);

      resultsArray.push({
        serverName: data.serverName,
        instanceType: data.instanceType || 'standard',
        tdp,
        cpuUtilization: cpu,
        pue: 1.2,
        region,
        hourlyRate: rate,
        environment: env,
        energyKWh: parseFloat(energy.toFixed(3)),
        carbonKg: parseFloat(carbon.toFixed(3)),
        costINR: parseFloat(cost.toFixed(2)),
        classification,
        isOptimized: false
      });
    })
    .on('end', async () => {
      if (responded) return; // 'error' already handled and responded
      responded = true;
      try {
        if (resultsArray.length === 0) {
          fs.unlinkSync(filePath); // Clean up temp file
          return res.status(400).json({
            success: false,
            message: "Validation error: no valid rows found in the uploaded file.",
            skippedRows
          });
        }

        // Wipe old temporary dataset entries to ensure fresh sync across panels
        await CloudResource.deleteMany({});
        
        // Batch insert newly parsed infrastructure entities. unordered so one
        // bad row (should be rare — already validated above) can't abort the
        // whole batch for a large real-world upload.
        const storedResources = await CloudResource.insertMany(resultsArray, { ordered: false });
        
        // Clean up file from temp directory storage
        fs.unlinkSync(filePath);

        const fatalSkips = skippedRows.filter(r => r.fatal !== false);
        await logAudit(`Fleet snapshot replaced from an uploaded CSV (${storedResources.length} rows)`);
        res.json({
          success: true,
          message: `Dataset successfully processed. Ingested ${storedResources.length} cloud node profiles.` +
            (fatalSkips.length > 0 ? ` ${fatalSkips.length} row(s) were skipped — see skippedRows for details.` : ''),
          count: storedResources.length,
          skippedRows
        });
      } catch (err) {
        console.error("Database ingestion runtime error:", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: "Database write storage fault." });
      }
    });
};

// Wipes the fleet snapshot back to empty — a deliberate, explicit reset
// (confirmed on the frontend) independent of login/logout, so a fresh demo
// or a new customer handoff can start from zero without touching auth.
exports.clearFleet = async (req, res) => {
  try {
    const { deletedCount } = await CloudResource.deleteMany({});
    await logAudit(`Fleet snapshot cleared — ${deletedCount} instance(s) removed`);
    res.json({ success: true, message: `Cleared ${deletedCount} instance(s). The fleet snapshot is now empty.`, deletedCount });
  } catch (err) {
    console.error('Error clearing fleet snapshot:', err);
    res.status(500).json({ success: false, message: 'Failed to clear the fleet snapshot.' });
  }
};