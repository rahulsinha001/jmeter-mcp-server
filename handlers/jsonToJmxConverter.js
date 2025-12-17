import fs from "fs";
import path from "path";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error("❌ Please provide Postman collection JSON file");
  process.exit(1);
}

const absolutePath = path.resolve(inputFile);

if (!fs.existsSync(absolutePath)) {
  console.error("❌ File not found:", absolutePath);
  process.exit(1);
}

const raw = fs.readFileSync(absolutePath, "utf-8").trim();

if (!raw) {
  console.error("❌ Postman JSON file is empty");
  process.exit(1);
}

let collection;
try {
  collection = JSON.parse(raw);
} catch (e) {
  console.error("❌ Invalid JSON:", e.message);
  process.exit(1);
}

if (!Array.isArray(collection.item)) {
  console.error("❌ Invalid Postman collection: no items found");
  process.exit(1);
}

const outDir = path.resolve("jmx");
fs.mkdirSync(outDir, { recursive: true });

const outFile = path.join(
  outDir,
  `generated_${path.basename(inputFile, ".json")}.jmx`
);

/* ---------------- JMX BUILDERS ---------------- */

function escapeXml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function httpSampler(item, idx) {
  const url = item.request.url;
  const host = Array.isArray(url.host) ? url.host.join(".") : "";
  const pathValue = "/" + (url.path || []).join("/");
  const method = item.request.method || "GET";

  return `
<HTTPSamplerProxy guiclass="HttpTestSampleGui"
  testclass="HTTPSamplerProxy"
  testname="${escapeXml(item.name || `Request ${idx + 1}`)}"
  enabled="true">
  <stringProp name="HTTPSampler.domain">${host}</stringProp>
  <stringProp name="HTTPSampler.protocol">https</stringProp>
  <stringProp name="HTTPSampler.path">${escapeXml(pathValue)}</stringProp>
  <stringProp name="HTTPSampler.method">${method}</stringProp>
  <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
  <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
</HTTPSamplerProxy>
<hashTree/>
`;
}

/* ---------------- JMX TEMPLATE ---------------- */

const samplers = collection.item.map(httpSampler).join("\n");

const jmx = `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>

    <!-- Test Plan -->
    <TestPlan guiclass="TestPlanGui"
      testclass="TestPlan"
      testname="Postman Converted Test Plan"
      enabled="true">
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
    </TestPlan>
    <hashTree>

      <!-- HTTP Request Defaults (GLOBAL TIMEOUTS) -->
      <ConfigTestElement guiclass="HttpDefaultsGui"
        testclass="ConfigTestElement"
        testname="HTTP Request Defaults"
        enabled="true">
        <stringProp name="HTTPSampler.connect_timeout">10000</stringProp>
        <stringProp name="HTTPSampler.response_timeout">15000</stringProp>
      </ConfigTestElement>
      <hashTree/>

      <!-- Thread Group -->
      <ThreadGroup guiclass="ThreadGroupGui"
        testclass="ThreadGroup"
        testname="Thread Group"
        enabled="true">
        <stringProp name="ThreadGroup.num_threads">1</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <boolProp name="ThreadGroup.same_user_on_next_iteration">true</boolProp>
        <elementProp name="ThreadGroup.main_controller"
          elementType="LoopController"
          guiclass="LoopControlPanel"
          testclass="LoopController"
          enabled="true">
          <stringProp name="LoopController.loops">1</stringProp>
          <boolProp name="LoopController.continue_forever">false</boolProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>

        ${samplers}

      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;

fs.writeFileSync(outFile, jmx, "utf-8");

console.log("✅ JMX generated successfully:");
console.log(outFile);
