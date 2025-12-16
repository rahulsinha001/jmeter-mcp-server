// handlers/correlationEngine.js
import fs from "fs";
import path from "path";
import { parseStringPromise } from "xml2js";

/**
 * Entry point
 */
export async function analyzeJMXForCorrelation(jmxFilePath) {
  if (!fs.existsSync(jmxFilePath)) {
    throw new Error(`JMX file not found: ${jmxFilePath}`);
  }

  const xml = fs.readFileSync(jmxFilePath, "utf-8");
  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    preserveChildrenOrder: true
  });

  const samplers = [];
  collectHTTPSamplers(parsed, samplers);

  const valueIndex = buildValueIndex(samplers);
  const suggestions = buildCorrelationSuggestions(valueIndex);

  return {
    jmxFile: path.basename(jmxFilePath),
    samplersScanned: samplers.length,
    correlationCandidates: suggestions.length,
    suggestions
  };
}

/* ----------------------- JMX Parsing ------------------------------- */
function collectHTTPSamplers(node, result, order = { index: 0 }) {
  if (!node || typeof node !== "object") return;

  if (node.HTTPSamplerProxy) {
    const samplers = Array.isArray(node.HTTPSamplerProxy)
      ? node.HTTPSamplerProxy
      : [node.HTTPSamplerProxy];

    samplers.forEach(s => {
      order.index++;
      result.push({
        order: order.index,
        name: s.$?.testname || `Sampler-${order.index}`,
        requestValues: extractRequestValues(s)
      });
    });
  }

  for (const key in node) {
    collectHTTPSamplers(node[key], result, order);
  }
}

/**
 * Extract literal values from sampler path, query params, and body/arguments
 */
function extractRequestValues(sampler) {
  const values = new Set();

  // 1️⃣ Extract path and query param values (ignore keys)
  const pathProp =
    sampler.stringProp?.find?.((p) => p.$?.name === "HTTPSampler.path") ||
    sampler.stringProp?.["HTTPSampler.path"];

  if (pathProp?._) {
    const fullPath = pathProp._.trim();

    // Extract query param values only (ignore keys)
    const [_, query] = fullPath.split("?");
    if (query) {
      const params = new URLSearchParams(query);
      for (const val of params.values()) {
        if (!isIgnorable(val)) values.add(val);
      }
    }

    // Extract literals from path segments (numeric, UUID, alphanumeric)
    extractLiterals(fullPath).forEach(v => values.add(v));
  }

  // 2️⃣ Extract arguments/body
  const args =
    sampler.elementProp?.collectionProp?.elementProp || [];

  const argList = Array.isArray(args) ? args : [args];

  argList.forEach(arg => {
    const valProp =
      arg.stringProp?.find?.((p) => p.$?.name === "Argument.value") ||
      arg.stringProp?.["Argument.value"];

    if (valProp?._) {
      const valText = valProp._.trim();
      if (valText && !isIgnorable(valText)) values.add(valText);
      extractLiterals(valText).forEach(v => values.add(v));
    }
  });

  return [...values];
}

/* ----------------------- Detection Logic --------------------------- */
function buildValueIndex(samplers) {
  const index = new Map();

  samplers.forEach(sampler => {
    sampler.requestValues.forEach(value => {
      if (isIgnorable(value)) return;

      if (!index.has(value)) index.set(value, []);
      index.get(value).push({
        samplerName: sampler.name,
        order: sampler.order
      });
    });
  });

  return index;
}

function buildCorrelationSuggestions(index) {
  const suggestions = [];

  for (const [value, occurrences] of index.entries()) {
    // Detect all dynamic values, even if only used once
    const confidence = calculateConfidence(value, occurrences);
    const type = classifyValue(value);

    suggestions.push({
      detectedValue: value,
      valueType: type,
      confidence,
      usedInSamplers: occurrences.map(o => o.samplerName),
      recommendation: buildRecommendation(value, type)
    });
  }

  return suggestions;
}

/* ----------------------- Heuristics -------------------------------- */
function classifyValue(value) {
  if (looksLikeJWT(value)) return "JWT_TOKEN";
  if (looksLikeUUID(value)) return "UUID";
  if (looksLikeNumericId(value)) return "NUMERIC_ID";
  if (looksLikeAlphaNumeric(value)) return "GENERIC_DYNAMIC_VALUE";
  return "UNKNOWN";
}

function calculateConfidence(value, occurrences) {
  if (occurrences.length >= 3) return "HIGH";
  if (looksLikeJWT(value) || looksLikeUUID(value)) return "HIGH";
  if (looksLikeNumericId(value)) return "MEDIUM";
  return "LOW";
}

function buildRecommendation(value, type) {
  switch (type) {
    case "JWT_TOKEN":
      return {
        extractor: "Regex Extractor",
        variableName: "jwt_token",
        regex: "eyJ[a-zA-Z0-9._-]+",
        usage: "Extract token from login response and use in Authorization header"
      };
    case "UUID":
      return {
        extractor: "JSON Extractor",
        variableName: "uuid_var",
        jsonPath: "$..id",
        usage: "Extract UUID from previous response"
      };
    case "NUMERIC_ID":
      return {
        extractor: "JSON Extractor",
        variableName: "id_var",
        jsonPath: "$..id",
        usage: "Replace hardcoded numeric ID with extracted variable"
      };
    default:
      return {
        extractor: "Regex / JSON Extractor",
        variableName: "dynamic_var",
        usage: "Extract from previous response before reuse"
      };
  }
}

/* ----------------------- Utilities --------------------------------- */
function extractLiterals(text) {
  const literals = [];
  if (!text) return literals;

  // UUID
  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  // JWT
  const jwtRegex = /eyJ[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g;
  // Numeric IDs (6–14 digits)
  const numRegex = /\b\d{6,14}\b/g;
  // Alphanumeric IDs (6–20 chars)
  const alphaNumRegex = /\b[a-zA-Z0-9]{6,20}\b/g;

  [uuidRegex, jwtRegex, numRegex, alphaNumRegex].forEach(r => {
    let m;
    while ((m = r.exec(text)) !== null) literals.push(m[0]);
  });

  return literals;
}

function isIgnorable(value) {
  if (!value) return true;
  if (value.startsWith("${")) return true; // already parameterized
  if (value === "true" || value === "false") return true;
  if (value.length < 4) return true;
  return false;
}

function looksLikeUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function looksLikeJWT(v) {
  return v.startsWith("eyJ") && v.split(".").length === 3;
}

function looksLikeNumericId(v) {
  return /^\d{6,14}$/.test(v);
}

function looksLikeAlphaNumeric(v) {
  return /^[a-zA-Z0-9]{6,20}$/.test(v);
}
