import fs from "fs";
import { parseStringPromise } from "xml2js";

/**
 * Parse JMX and extract HTTP samplers with request data
 * Phase-1 safe, Phase-2 ready
 */
export async function parseJMX(jmxPath) {
  const xml = fs.readFileSync(jmxPath, "utf-8");

  const jmx = await parseStringPromise(xml, {
    explicitArray: false,
    preserveChildrenOrder: true
  });

  const samplers = [];
  let order = 0;

  function walk(node) {
    if (!node || typeof node !== "object") return;

    if (node.HTTPSamplerProxy) {
      const list = Array.isArray(node.HTTPSamplerProxy)
        ? node.HTTPSamplerProxy
        : [node.HTTPSamplerProxy];

      list.forEach(sampler => {
        order++;

        samplers.push({
          order,
          name: sampler.$?.testname || `Sampler-${order}`,
          method: getStringProp(sampler, "HTTPSampler.method"),
          path: getStringProp(sampler, "HTTPSampler.path"),
          arguments: extractArguments(sampler),
          raw: sampler // IMPORTANT for Phase-2 auto-fix
        });
      });
    }

    Object.values(node).forEach(walk);
  }

  walk(jmx.jmeterTestPlan);

  return samplers;
}

/* ------------------------------------------------ */
/* ---------------- Helpers ------------------------ */
/* ------------------------------------------------ */

function getStringProp(sampler, propName) {
  const props = sampler.stringProp;
  if (!props) return "";

  const arr = Array.isArray(props) ? props : [props];
  return arr.find(p => p.$?.name === propName)?._ || "";
}

function extractArguments(sampler) {
  const args = [];

  const elementProp = sampler.elementProp;
  if (!elementProp) return args;

  const argBlock = Array.isArray(elementProp)
    ? elementProp.find(e => e.$?.name === "HTTPsampler.Arguments")
    : elementProp.$?.name === "HTTPsampler.Arguments"
      ? elementProp
      : null;

  if (!argBlock?.collectionProp?.elementProp) return args;

  const params = Array.isArray(argBlock.collectionProp.elementProp)
    ? argBlock.collectionProp.elementProp
    : [argBlock.collectionProp.elementProp];

  params.forEach(p => {
    const name = findStringProp(p, "Argument.name");
    const value = findStringProp(p, "Argument.value");

    if (value) {
      args.push({
        name,
        value
      });
    }
  });

  return args;
}

function findStringProp(node, propName) {
  const props = node.stringProp;
  if (!props) return "";

  const arr = Array.isArray(props) ? props : [props];
  return arr.find(p => p.$?.name === propName)?._ || "";
}
