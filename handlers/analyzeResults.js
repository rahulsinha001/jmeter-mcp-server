import fs from "fs";
import csv from "csv-parser";

export function analyzeJTL(jtlPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(jtlPath)) {
      return reject(new Error(`JTL file not found: ${jtlPath}`));
    }

    const times = [];
    let total = 0;
    let errors = 0;
    let firstTS = null;
    let lastTS = null;

    fs.createReadStream(jtlPath)
      .pipe(csv())
      .on("data", row => {
        total++;

        const rt = Number(row.elapsed);
        const ts = Number(row.timeStamp);

        if (!isNaN(rt) && rt >= 0) {
          times.push(rt);
        }

        if (row.success === "false") {
          errors++;
        }

        if (!isNaN(ts)) {
          if (!firstTS || ts < firstTS) firstTS = ts;
          if (!lastTS || ts > lastTS) lastTS = ts;
        }
      })
      .on("end", () => {
        if (times.length === 0) {
          return reject(new Error("No valid samples found in JTL"));
        }

        times.sort((a, b) => a - b);

        const pct = p =>
          times[Math.ceil((p / 100) * times.length) - 1];

        const durationSec =
          firstTS && lastTS ? (lastTS - firstTS) / 1000 : 0;

        resolve({
          totalSamples: total,
          validSamples: times.length,
          errorCount: errors,
          errorPct: ((errors / total) * 100).toFixed(2),
          avgRT: (
            times.reduce((a, b) => a + b, 0) / times.length
          ).toFixed(2),
          min: times[0],
          max: times[times.length - 1],
          p90: pct(90),
          p95: pct(95),
          p99: pct(99),
          throughput:
            durationSec > 0
              ? (total / durationSec).toFixed(2)
              : "NA",
          testDurationSec: durationSec.toFixed(2)
        });
      })
      .on("error", reject);
  });
}
