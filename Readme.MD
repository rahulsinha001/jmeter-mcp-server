# JMeter MCP Server (VS Code Task–Driven)

This repository provides a **VS Code–driven JMeter execution and analysis framework** powered by a lightweight **MCP (Model Context Protocol) server**. The entire workflow is executed via **VS Code Tasks (`Ctrl + Shift + B`)** — no manual CLI commands required.

The project is intentionally designed to:

* Run **existing JMX files as-is** (created from JMeter UI)
* Convert **Postman collections to valid JMeter JMX files**
* Optionally run **JMX files with dynamic runtime parameters**
* Provide **correlation suggestions**
* Generate **HTML reports**
* Perform **basic result analysis**

---

## 1. Repository Structure

```
JMETER-MCP-SERVER/
│
├── .vscode/
│   └── tasks.json                    # All execution is driven from here
│
├── handlers/
│   ├── analyzeResults.js             # Parses JTL & provides summary analysis
│   ├── correlationEngine.js          # Detects potential dynamic values for correlation
│   ├── jmxParser.js                  # Parses JMX XML structure
│   ├── listTests.js                  # Lists available JMX tests
│   ├── jsonToJmxConverter.js         # Converts Postman collection → JMeter JMX
│   └── runJMeter.js                  # Placeholder (will be used for enhancements)
│
├── jmx/                              # Place all JMeter test plans here
│   ├── demoApi.jmx
│   ├── demoReqResApis.jmx
│   ├── postman-echo_demo.jmx
│   ├── postman-echo-complex-dynamic.jmx
│   ├── postman-echo-multi-dynamic-ids.jmx
│   ├── sample_test.jmx
│   └── generated_demo_collection.jmx # Auto-generated from Postman
│
├── postman/
│   └── demo_collection.json          # Postman collection input
│
├── reports/                          # Auto-generated JMeter reports
├── temp/                             # Temporary execution files
│
├── .env                              # Environment configuration (JMeter path)
├── server-mcp-full.js                # MCP Server entry point
├── package.json
├── package-lock.json
└── README.md
```

---

## 2. Prerequisites (For All Teammates)

### Required Software

| Software      | Recommended Version  |
| ------------- | -------------------- |
| Node.js       | v18+ (LTS preferred) |
| Apache JMeter | 5.6.x                |
| VS Code       | Latest               |
| Git           | Latest               |

---

## 3. Cloning the Repository

```bash
git clone https://github.com/rahulsinha001/jmeter-mcp-server.gi
cd jmeter-mcp-server
```

---

## 4. Dependency Installation

Install Node.js dependencies:

```bash
npm install
```

This installs all required Node packages used by the MCP server and handlers.

---

## 5. JMeter Installation & Configuration

### Install JMeter

* Download Apache JMeter **5.6.x**
* Extract it anywhere on your system

Example locations:

* Windows: `C:/apache-jmeter-5.6.3/`
* macOS/Linux: `/opt/apache-jmeter-5.6.3/`

### Verify JMeter

```bash
jmeter -v
```

---

## 6. Environment Configuration (`.env`)

Create a `.env` file in project root:

```env
JMETER_PATH=/path/to/apache-jmeter/bin/jmeter
PORT=4000
```

📌 **Important Notes:**

* Use **absolute path** to `jmeter` executable
* Do NOT commit personal paths
* Use placeholders like `/path/to/apache-jmeter/bin/jmeter`

This file **can be committed** if paths are generic.

---

## 7. VS Code Tasks – How Everything Runs

This project does **NOT require manual CLI execution**.

All actions are executed via:

```
Ctrl + Shift + B
```

You will see a list of tasks such as:

* Start MCP Server
* Run JMeter (As-Is)
* Run JMeter via MCP (Dynamic)
* Convert Postman Collection to JMX
* List all JMX files
* Analyze Results
* Open HTML Report
* Get Correlation Suggestions

---

## 8. Postman Collection → JMeter JMX Conversion

This framework supports direct conversion of Postman collections into valid JMeter JMX files, ready for execution.

### How to Convert

1. Place your Postman collection under the `postman/` folder
2. Press `Ctrl + Shift + B`
3. Select **Convert Postman Collection to JMX**
4. Enter path, for example:

```
postman/demo_collection.json
```

✅ Generated output:

```
jmx/generated_demo_collection.jmx
```

The generated JMX:

* Loads cleanly in JMeter GUI
* Executes correctly via CLI / MCP
* Includes safe default HTTP timeouts

---

## 9. Running JMeter – Two Supported Modes

### 🔹 Option 1: Run JMX As-Is (Recommended)

Use this when:

* JMX already has thread group settings
* Load model is defined in JMeter UI or generated JMX

Flow:

1. Press `Ctrl + Shift + B`
2. Select **Run JMeter (As-Is)**
3. Enter JMX file name

➡ JMeter runs exactly as defined in the JMX.

---

### 🔹 Option 2: Run JMX With Dynamic Parameters

Use this when:

* You want runtime control without editing JMX
* JMX supports JMeter properties

Required JMX fields:

```
Threads:   ${__P(users,1)}
Ramp-Up:  ${__P(rampUp,1)}
Duration: ${__P(duration,60)}
```

Flow:

1. Press `Ctrl + Shift + B`
2. Select **Run JMeter via MCP (Dynamic)**
3. Provide:

   * users
   * rampUp
   * duration

➡ Parameters are passed using `-J` properties.

---

## 10. MCP Server (`server-mcp-full.js`)

### Responsibilities

* Starts HTTP server (default port 4000)
* Receives run requests from VS Code tasks
* Executes JMeter using Node.js
* Generates:

  * JTL files
  * HTML reports

Start using:

```
Ctrl + Shift + B → Start MCP Server
```

---

## 11. Handlers – What Each File Does

### `jsonToJmxConverter.js`

* Converts Postman collections to valid JMeter JMX
* Builds correct JMeter HashTree structure
* Injects safe default HTTP timeouts

### `runJMeter.js`

* Builds JMeter command
* Handles execution modes
* Writes results to `/reports`

### `jmxParser.js`

* Reads JMX XML
* Extracts samplers and parameters

### `correlationEngine.js`

* Scans request paths, parameters, bodies
* Detects potential dynamic values
* Returns **suggestions only** (no auto-modification)

### `analyzeResults.js`

* Parses JTL files
* Computes basic metrics

---

## 12. Reports

* JTL + HTML reports stored under:

```
/reports/<runId>/
```

Open latest report:

```
Ctrl + Shift + B → Open last generated HTML report
```

---

## 13. Adding New Tests

### JMeter UI

1. Create test in JMeter UI
2. Save `.jmx`
3. Copy to `jmx/`
4. Run using VS Code tasks

### Postman

1. Export Postman collection (v2.x)
2. Copy to `postman/`
3. Convert using VS Code task
4. Run generated JMX

---

## 14. Current Implementation Scope

✔ JMX execution
✔ Postman → JMX conversion
✔ Dynamic parameter support
✔ Correlation suggestions
✔ Result analysis
✔ HTML report generation
✔ VS Code task–driven UX

---

## 15. Future Enhancements (Planned)

* Auto-injection of runtime parameters into JMX
* Smarter correlation classification
* Distributed execution support
* GenAI-assisted test insights
* Advanced performance trend analysis

---

## 16. Team Onboarding (Quick Checklist)

1. Clone repo
2. Install Node.js + JMeter
3. Configure `.env`
4. Run `npm install`
5. Open VS Code
6. Press `Ctrl + Shift + B`
7. Select desired task

---

## 17. Final Notes

* This framework **does not replace JMeter UI**
* It complements it with **repeatable execution & automation**
* Ideal for demos, POCs, interviews, and internal teams

---

Happy Testing 🚀
