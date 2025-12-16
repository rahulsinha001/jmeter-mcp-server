// handlers/runJMeter.js
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeLogs, autoCorrelate } from "./correlationEngine.js";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log JMETER_PATH at startup
console.log(">>> Loaded JMETER_PATH =", process.env.JMETER_PATH);

export async function runJMeterTest(jmxFile) {
  return new Promise((resolve, reject) => {
    try {
      const jmxPath = path.join(__dirname, "..", "jmx", jmxFile);

      if (!fs.existsSync(jmxPath)) {
        return reject({ error: `JMX file not found: ${jmxFile}` });
      }

      const runId = generateId();
      const reportDir = path.join(__dirname, "..", "reports", runId);
      const htmlReport = path.join(reportDir, "html");
      const resultFile = path.join(reportDir, "result.jtl");

      fs.mkdirSync(reportDir, { recursive: true });

      // Load JMeter path from .env or fallback
      let jmeterExecutable =
        process.env.JMETER_PATH || "C:/apache-jmeter-5.6.3/bin/jmeter.bat";

      // Sanitize path for Windows (replace single slashes with double-slashes if needed)
      jmeterExecutable = jmeterExecutable.replace(/\\/g, "/");

      console.log("Using JMeter executable:", jmeterExecutable);

      const cmd = `"${jmeterExecutable}" -n -t "${jmxPath}" -l "${resultFile}" -e -o "${htmlReport}"`;
      console.log("Executing:", cmd);

      exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        let suggestions = [];

        // Only analyze if result JTL exists
        if (fs.existsSync(resultFile)) {
          const logs = fs.readFileSync(resultFile, "utf8");
          suggestions.push(...analyzeLogs(stdout, stderr));
          suggestions.push(...autoCorrelate(logs));

          // Remove duplicates
          suggestions = suggestions.filter(
            (x, i, self) =>
              i === self.findIndex((y) => JSON.stringify(y) === JSON.stringify(x))
          );
        }

        if (error) {
          const response = {
            error: "JMeter execution failed",
            stdout,
            stderr,
          };
          if (suggestions.length > 0) response.suggestions = suggestions;
          return reject(response);
        }

        const response = {
          message: "JMeter test executed successfully",
          runId,
          reportUrl: `/reports/${runId}/html/index.html`,
          stdout,
          stderr,
        };
        if (suggestions.length > 0) response.suggestions = suggestions;

        resolve(response);
      });
    } catch (err) {
      reject({ error: err.message });
    }
  });
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + "-" + Date.now();
}