# JMeter MCP Server (VS Code Task–Driven)

This repository provides a **VS Code–driven JMeter execution and analysis framework** powered by a lightweight **MCP (Model Context Protocol) server**. The entire workflow is executed via **VS Code Tasks (`Ctrl + Shift + B`)** — no manual CLI commands required.

The project is intentionally designed to:

* Run **existing JMX files as-is** (created from JMeter UI)
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
│   └── tasks.json              # All execution is driven from here
│
├── handlers/
│   ├── analyzeResults.js       # Parses JTL & provides summary analysis
│   ├── correlationEngine.js    # Detects potential dynamic values for correlation
│   ├── jmxParser.js            # Parses JMX XML structure
│   ├── listTests.js            # Lists available JMX tests
│   └── runJMeter.js            # Placeholder (will be used by MCP server for future enhancements)
│
├── jmx/                         # Place all JMeter test plans here
│   ├── demoApi.jmx -- # This is plain JMX file without having dynamic parameters like- THread Group etc.
│   ├── demoReqResApis.jmx
│   ├── postman-echo_demo.jmx
│   ├── postman-echo-complex-dynamic.jmx
│   ├── postman-echo-multi-dynamic-ids.jmx
│   └── sample_test.jmx
│
├── reports/                     # Auto-generated JMeter reports
├── temp/                        # Temporary execution files
│
├── .env                         # Environment configuration (JMeter path)
├── server-mcp-full.js           # MCP Server entry point
├── package.json
├── package-lock.json
└── README.md
```

---

## 2. Prerequisites

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
git clone https://github.com/rahulsinha001/jmeter-mcp-server.git
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

```text
Ctrl + Shift + B
```

You will see a list of tasks such as:

* Start MCP Server
* Run JMeter via MCP (with dynamic runtime parameters)
* Run JMeter (As-Is)
* List all JMX files
* Analyze Results
* Analyze last run automatically
* Open HTML Report
* Get Correlation Suggestions
* Clear all JMeter Reports

---

## 8. Running JMeter – Two Supported Modes

### 🔹 Option 1: Run JMX As-Is (Recommended for UI-created tests)

Use this when:

* JMX already has thread group settings
* Load model is defined in JMeter UI

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

## 9. MCP Server (`server-mcp-full.js`)

### Responsibilities

* Starts HTTP server (default port 4000)
* Receives run requests from VS Code tasks
* Executes JMeter using Node
* Generates:

  * JTL files
  * HTML reports

You start it using:

```
Ctrl + Shift + B → Start MCP Server
```

---

## 10. Handlers – What Each File Does

### `runJMeter.js`

* Builds JMeter command
* Handles both execution modes
* Writes results to `/reports`

### `jmxParser.js`

* Reads JMX XML
* Extracts samplers and parameters
* Used by correlation engine

### `correlationEngine.js`

* Scans request paths, parameters, bodies
* Detects potential dynamic values
* Returns **suggestions only** (no auto-modification)

### `analyzeResults.js`

* Parses JTL files
* Computes basic metrics
* Used by analysis tasks

---

## 11. Correlation Suggestions

Run via:

```
Ctrl + Shift + B → Get Correlation Suggestions
```

This:

* Does NOT change JMX
* Provides insight similar to LoadRunner correlation hints

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

## 13. Adding New JMX Tests

1. Create test in JMeter UI
2. Save `.jmx`
3. Copy to `jmx/` folder
4. Run using VS Code tasks

No code changes required.

---

## 14. Current Implementation Scope

✔ JMX execution
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

---

Happy Testing 🚀
