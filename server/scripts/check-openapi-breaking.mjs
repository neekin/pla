import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const basePath = resolve(
  process.cwd(),
  process.env.OPENAPI_BASELINE ?? 'openapi/openapi.baseline.json',
);
const generatedPath = resolve(
  process.cwd(),
  process.env.OPENAPI_GENERATED ?? 'openapi/openapi.generated.json',
);
const reportJsonPath = resolve(
  process.cwd(),
  process.env.OPENAPI_BREAKING_REPORT_JSON ?? 'openapi/openapi.breaking-report.json',
);
const reportMdPath = resolve(
  process.cwd(),
  process.env.OPENAPI_BREAKING_REPORT_MD ?? 'openapi/openapi.breaking-report.md',
);

const baseline = JSON.parse(readFileSync(basePath, 'utf-8'));
const generated = JSON.parse(readFileSync(generatedPath, 'utf-8'));

const issues = [];

const basePaths = baseline.paths ?? {};
const nextPaths = generated.paths ?? {};

for (const [pathKey, operations] of Object.entries(basePaths)) {
  if (!(pathKey in nextPaths)) {
    issues.push(`Path removed: ${pathKey}`);
    continue;
  }

  const nextOperations = nextPaths[pathKey] ?? {};
  for (const [method, op] of Object.entries(operations ?? {})) {
    if (!(method in nextOperations)) {
      issues.push(`Operation removed: ${method.toUpperCase()} ${pathKey}`);
      continue;
    }

    const nextOp = nextOperations[method] ?? {};

    // 1) requestBody previously optional -> now required is breaking
    if (isNowRequired(op?.requestBody, nextOp?.requestBody)) {
      issues.push(`Request body became required: ${method.toUpperCase()} ${pathKey}`);
    }

    // 2) required parameters additions are breaking
    const baseRequiredParams = requiredParams(op?.parameters);
    const nextRequiredParams = requiredParams(nextOp?.parameters);
    for (const param of nextRequiredParams) {
      if (!baseRequiredParams.has(param)) {
        issues.push(
          `New required parameter: ${method.toUpperCase()} ${pathKey} -> ${param}`,
        );
      }
    }

    // 3) previously documented success/error status removed is breaking
    const baseResponses = Object.keys(op?.responses ?? {});
    const nextResponses = new Set(Object.keys(nextOp?.responses ?? {}));
    for (const code of baseResponses) {
      if (!nextResponses.has(code)) {
        issues.push(
          `Response code removed: ${method.toUpperCase()} ${pathKey} -> ${code}`,
        );
      }
    }
  }
}

if (issues.length > 0) {
  writeReport({
    ok: false,
    baseline: basePath,
    generated: generatedPath,
    issues,
    reportJsonPath,
    reportMdPath,
  });

  console.error('❌ OpenAPI breaking-change gate failed.');
  console.error(`baseline:  ${basePath}`);
  console.error(`generated: ${generatedPath}`);
  console.error(`report:    ${reportJsonPath}`);
  console.error('Detected breaking changes:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

writeReport({
  ok: true,
  baseline: basePath,
  generated: generatedPath,
  issues,
  reportJsonPath,
  reportMdPath,
});

console.log('✅ OpenAPI breaking-change gate passed (no breaking changes).');
console.log(`📄 OpenAPI breaking report: ${reportJsonPath}`);

function requiredParams(parameters) {
  const set = new Set();
  for (const p of parameters ?? []) {
    if (!p || typeof p !== 'object') continue;
    if (p.required === true) {
      const name = String(p.name ?? 'unknown');
      const location = String(p.in ?? 'unknown');
      set.add(`${location}:${name}`);
    }
  }
  return set;
}

function isNowRequired(baseRequestBody, nextRequestBody) {
  const beforeRequired = baseRequestBody?.required === true;
  const afterRequired = nextRequestBody?.required === true;
  return !beforeRequired && afterRequired;
}

function writeReport(input) {
  const payload = {
    ok: input.ok,
    baseline: input.baseline,
    generated: input.generated,
    issueCount: input.issues.length,
    issues: input.issues,
    checkedAt: new Date().toISOString(),
  };

  writeFileSync(input.reportJsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');

  const lines = [
    '# OpenAPI Breaking Change Report',
    '',
    `- Result: ${input.ok ? 'PASS' : 'FAIL'}`,
    `- Checked At: ${payload.checkedAt}`,
    `- Baseline: ${input.baseline}`,
    `- Generated: ${input.generated}`,
    `- Issue Count: ${input.issues.length}`,
    '',
    '## Issues',
    '',
  ];

  if (input.issues.length === 0) {
    lines.push('- None');
  } else {
    for (const issue of input.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push('');
  writeFileSync(input.reportMdPath, lines.join('\n'), 'utf-8');
}
