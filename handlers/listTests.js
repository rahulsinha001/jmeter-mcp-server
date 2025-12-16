// handlers/listTests.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const listTests = () => {
  const jmxDir = path.join(__dirname, "..", "jmx");
  const files = fs.readdirSync(jmxDir).filter((f) => f.endsWith(".jmx"));
  return files;
};
