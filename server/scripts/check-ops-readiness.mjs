import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredFiles = [
  resolve(process.cwd(), '..', 'ops', 'slo', 'slo-definitions.yml'),
  resolve(process.cwd(), '..', 'ops', 'oncall', 'rotation.md'),
  resolve(process.cwd(), '..', 'ops', 'runbook', 'auto-remediation.yml'),
];

const missing = requiredFiles.filter((filePath) => !existsSync(filePath));

if (missing.length > 0) {
  console.error('❌ Ops readiness gate failed. Missing files:');
  for (const filePath of missing) {
    console.error(`- ${filePath}`);
  }
  process.exit(1);
}

console.log('✅ Ops readiness gate passed.');
