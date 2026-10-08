import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const contract = JSON.parse(readFileSync(new URL("contracts/sdk-v1.json", root), "utf8"));
const source = readFileSync(new URL("src/index.ts", root), "utf8");
const checkout = contract.checkout_messages;
const missing = [];

if (!source.includes(`source: "${checkout.source}"`)) missing.push(`message source ${checkout.source}`);
for (const type of checkout.types) {
  if (!source.includes(`"${type}"`)) missing.push(`message type ${type}`);
}
for (const field of checkout.transaction_fields) {
  if (!source.includes(field)) missing.push(`transaction field ${field}`);
}
if (!source.includes(`message.version !== ${checkout.version}`)) missing.push(`message version ${checkout.version} guard`);

if (missing.length > 0) {
  console.error(`Checkout JS contract ${contract.contract_version} failed:\n- ${missing.join("\n- ")}`);
  process.exit(1);
}

console.log(`Checkout JS contract ${contract.contract_version} passed.`);
