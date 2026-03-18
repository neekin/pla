import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const openapiFilePath = resolve(process.cwd(), 'openapi', 'openapi.generated.json');
const consumerDir = resolve(process.cwd(), 'contracts', 'consumers');

const openapi = JSON.parse(readFileSync(openapiFilePath, 'utf8'));
const pathKeys = new Set(Object.keys(openapi.paths ?? {}));

const consumerFiles = readdirSync(consumerDir).filter((fileName) => fileName.endsWith('.json'));
const issues = [];

for (const fileName of consumerFiles) {
  const filePath = resolve(consumerDir, fileName);
  const consumer = JSON.parse(readFileSync(filePath, 'utf8'));

  for (const requiredPath of consumer.requiredPaths ?? []) {
    if (!pathKeys.has(requiredPath)) {
      issues.push(`${consumer.consumer ?? fileName}: missing path ${requiredPath}`);
    }
  }
}

if (issues.length > 0) {
  console.error('❌ Consumer contract gate failed.');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('✅ Consumer contract gate passed.');
