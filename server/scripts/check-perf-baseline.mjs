import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baselinePath = resolve(process.cwd(), 'perf', 'perf-baseline.json');
const regressionDatasetPath = resolve(process.cwd(), 'test', 'regression', 'regression-dataset.json');

if (!existsSync(baselinePath)) {
  console.error('❌ Perf baseline file missing: perf/perf-baseline.json');
  process.exit(1);
}

if (!existsSync(regressionDatasetPath)) {
  console.error('❌ Regression dataset missing: test/regression/regression-dataset.json');
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

if (!baseline.thresholds?.healthCheck?.maxLatencyMs || !baseline.thresholds?.authLogin?.maxLatencyMs) {
  console.error('❌ Perf baseline missing required thresholds: healthCheck/authLogin');
  process.exit(1);
}

console.log('✅ Perf baseline gate passed.');
