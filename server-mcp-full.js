// server-mcp-full.js
// Fully MCP-capable hybrid JMeter server
// - MCP stdin/stdout
// - HTTP APIs
// - JMeter execution
// - Result analysis
// - Phase-1 Correlation Detection (NO auto-fix)

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import readline from "readline";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import archiver from "archiver";
import { fileURLToPath } from "url";

// JSON colorizer for terminal
import { colorize } from "json-colorizer";

// Analyzer
import { analyzeJTL } from "./handlers/analyzeResults.js";

// ✅ Correlation Engine (Phase-1)
import { analyzeJMXForCorrelation } from "./handlers/correlationEngine.js";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JMETER_PATH = process.env.JMETER_PATH || "C:/apache-jmeter-5.6.3/bin/jmeter.bat";

// Directories
const JMX_DIR = path.join(__dirname, "jmx");
const REPORTS_DIR = path.join(__dirname, "reports");

// Ensure folders exist
fs.mkdirSync(JMX_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Helpers
function generateRunId() {
  return Math.random().toString(36).substring(2, 10) + "-" + Date.now();
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(outPath));
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// -------------------- JMeter Execution --------------------
async function runJMeterInternal(jmxFile, extraArgs = []) {
  const jmxPath = path.isAbsolute(jmxFile) ? jmxFile : path.join(JMX_DIR, jmxFile);

  if (!fs.existsSync(jmxPath))
    throw new Error(`JMX file not found: ${jmxPath}`);

  const runId = generateRunId();
  const runDir = path.join(REPORTS_DIR, runId);
  const htmlDir = path.join(runDir, "html");
  const resultFile = path.join(runDir, "result.jtl");

  fs.mkdirSync(runDir, { recursive: true });

  const args = [
    "-n",
    "-t",
    jmxPath,
    "-l",
    resultFile,
    "-e",
    "-o",
    htmlDir,
    ...extraArgs
  ];

  const cmd = `"${JMETER_PATH}" ${args.map(a => `"${a}"`).join(" ")}`;

  return new Promise(resolve => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      resolve({
        runId,
        runDir,
        htmlDir,
        resultFile,
        stdout: stdout ? String(stdout) : "",
        stderr: stderr ? String(stderr) : "",
        error: error ? error.message : null
      });
    });
  });
}

// -------------------- MCP Capability Advertisement --------------------
function advertiseCapabilities() {
  const capabilities = {
    type: "mcp_capabilities",
    version: "1.0",
    tools: [
      {
        name: "listTests",
        description: "List available JMeter .jmx files",
        input_schema: { type: "object", properties: {}, additionalProperties: false }
      },
      {
        name: "runJMeter",
        description: "Run a JMeter .jmx file (non-GUI)",
        input_schema: {
          type: "object",
          properties: {
            jmxFile: { type: "string" },
            jmeterArgs: { type: "array", items: { type: "string" } }
          },
          required: ["jmxFile"]
        }
      },
      {
        name: "getReportZip",
        description: "Return base64 ZIP of HTML report for a given runId",
        input_schema: {
          type: "object",
          properties: { runId: { type: "string" } },
          required: ["runId"]
        }
      },
      {
        name: "analyzeRun",
        description: "Analyze result.jtl for a given runId",
        input_schema: {
          type: "object",
          properties: { runId: { type: "string" } },
          required: ["runId"]
        }
      },
      {
        name: "detectCorrelation",
        description: "Scan a JMX file and suggest correlation candidates",
        input_schema: {
          type: "object",
          properties: { jmxFile: { type: "string" } },
          required: ["jmxFile"]
        }
      },
      {
        name: "cleanup",
        description: "Delete all generated reports",
        input_schema: { type: "object", properties: {}, additionalProperties: false }
      }
    ]
  };

  // Terminal output with colors
  console.log(colorize(capabilities, { pretty: true }));
}

// -------------------- MCP Request Handler --------------------
async function handleMCPRequest(json) {
  const { id, method, params } = json;

  try {
    if (method === "listTests") {
      const tests = fs.readdirSync(JMX_DIR).filter(f => f.endsWith(".jmx"));
      return { id, result: { tests } };
    }

    if (method === "runJMeter") {
      const { jmxFile, jmeterArgs } = params || {};
      const r = await runJMeterInternal(jmxFile, jmeterArgs || []);
      return { id, result: r };
    }

    if (method === "getReportZip") {
      const { runId } = params || {};
      const htmlDir = path.join(REPORTS_DIR, runId, "html");
      if (!fs.existsSync(htmlDir)) return { id, error: "Report not found" };

      const zipPath = path.join(REPORTS_DIR, `${runId}.zip`);
      await zipDirectory(htmlDir, zipPath);
      const base64 = fs.readFileSync(zipPath).toString("base64");

      return { id, result: { fileName: `${runId}.zip`, data: base64 } };
    }

    if (method === "analyzeRun") {
      const { runId } = params || {};
      const jtlPath = path.join(REPORTS_DIR, runId, "result.jtl");
      if (!fs.existsSync(jtlPath))
        return { id, error: "result.jtl not found" };

      const summary = await analyzeJTL(jtlPath);
      return { id, result: { runId, summary } };
    }

    // ✅ NEW CORRELATION MCP HANDLER
    if (method === "detectCorrelation") {
      const { jmxFile } = params || {};
      if (!jmxFile) return { id, error: "jmxFile is required" };

      const jmxPath = path.join(JMX_DIR, jmxFile);
      const report = await analyzeJMXForCorrelation(jmxPath);

      // Colored + pretty log in terminal
      console.log(colorize(report, { pretty: true }));

      return { id, result: report };
    }

    if (method === "cleanup") {
      fs.rmSync(REPORTS_DIR, { recursive: true, force: true });
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      return { id, result: "cleanup-complete" };
    }

    return { id, error: `Unknown method: ${method}` };
  } catch (err) {
    return { id, error: err.message };
  }
}

// -------------------- MCP Listener --------------------
function startMCPListener() {
  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", async line => {
    try {
      const req = JSON.parse(line);
      const res = await handleMCPRequest(req);
      process.stdout.write(JSON.stringify(res, null, 2) + "\n"); // pretty JSON for stdin/stdout
    } catch {
      process.stdout.write(JSON.stringify({ error: "Invalid JSON" }, null, 2) + "\n");
    }
  });

  advertiseCapabilities();
}

// -------------------- HTTP Server --------------------
function startHttpServer() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use("/reports", express.static(REPORTS_DIR));

  app.get("/tests", (req, res) => {
    const tests = fs.readdirSync(JMX_DIR).filter(f => f.endsWith(".jmx"));
    res.json({ tests });
  });

  app.post("/run", async (req, res) => {
    const { jmxFile, jmeterArgs } = req.body || {};
    if (!jmxFile) return res.status(400).json({ error: "jmxFile is required" });

    const r = await runJMeterInternal(jmxFile, jmeterArgs || []);
    res.json(r);
  });

  // ✅ HTTP CORRELATION API
  app.get("/correlate/:jmxFile", async (req, res) => {
    try {
      const jmxPath = path.join(JMX_DIR, req.params.jmxFile);
      if (!fs.existsSync(jmxPath))
        return res.status(404).json({ error: "JMX not found" });

      const report = await analyzeJMXForCorrelation(jmxPath);

      // log beautified + colored JSON in terminal
      console.log(colorize(report, { pretty: true }));

      // send pretty JSON in HTTP response
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(report, null, 2));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Analysis API
  app.get("/analyze/:runId", async (req, res) => {
    const jtlPath = path.join(REPORTS_DIR, req.params.runId, "result.jtl");
    if (!fs.existsSync(jtlPath))
      return res.status(404).json({ error: "result.jtl not found" });

    const summary = await analyzeJTL(jtlPath);
    res.json({ runId: req.params.runId, summary });
  });

  app.listen(PORT, () => {
    console.log(`HTTP server running at http://localhost:${PORT}`);
  });
}

// -------------------- Start Everything --------------------
startMCPListener();
startHttpServer();

console.log("MCP stdin/stdout + HTTP server started");
console.log("JMX directory:", JMX_DIR);
console.log("Reports directory:", REPORTS_DIR);
console.log("Using JMeter path:", JMETER_PATH);
