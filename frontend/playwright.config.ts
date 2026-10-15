import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const reportPrefix = (process.env.E2E_REPORT_PREFIX || '').replace(/[^a-z0-9_-]/gi, '');
const prefix = reportPrefix ? `${reportPrefix}-` : '';
const python = process.env.PYTHON_BINARY || (existsSync('../.venv/bin/python') ? resolve('../.venv/bin/python') : existsSync('../.venv/Scripts/python.exe') ? resolve('../.venv/Scripts/python.exe') : 'python');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 20000 },
  reporter: [['list'], ['junit', { outputFile: `../docs/${prefix}e2e-tests.xml` }], ['json', { outputFile: `../docs/${prefix}e2e-tests.json` }]],
  outputDir: `../docs/${prefix}e2e-artifacts`,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: `"${python}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000`, cwd: '../backend', url: 'http://127.0.0.1:8000/api/health', reuseExistingServer: !process.env.CI, timeout: 60000 },
    ...(baseURL === 'http://127.0.0.1:8000' ? [] : [{ command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 60000 }]),
  ],
});
