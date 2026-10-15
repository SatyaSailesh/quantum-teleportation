import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// All positive tests hit the real FastAPI/Qiskit Aer engine through Vite's
// relative /api proxy. Only the explicit failure test intercepts an endpoint.
test('ideal startup, real API proxy, and synchronized circuit', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).engine).toBe('Qiskit Aer');
  await page.goto('/');
  await expect(page.getByTestId('overview-fidelity')).toHaveText('1.0000');
  await expect(page.getByText('Engine online', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="circuit-view"] [data-operation="measure"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="circuit-view"] [data-noise="true"]')).toHaveCount(0);
  await expect(page.getByTestId('fidelity-chart')).toBeVisible();
  expect(errors).toEqual([]);
});

test('state parameters, in-circuit depolarizing noise, native drawing, and reset', async ({ page }) => {
  await page.goto('/simulator');
  await expect(page.getByTestId('fidelity-value')).toHaveText('1.0000');
  await page.getByRole('switch', { name: 'Enable circuit noise' }).click();
  await page.getByLabel('Noise channel', { exact: true }).selectOption('depolarizing');
  await page.getByLabel('p · Noise strength value', { exact: true }).fill('0.5');
  await expect(page.getByTestId('fidelity-value')).toHaveText('0.7500');
  await expect(page.locator('[data-testid="circuit-view"] [data-noise="true"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="circuit-view"] [data-noise="true"]')).toHaveAttribute('data-operation', 'kraus');
  await page.getByRole('button', { name: 'Qiskit native', exact: true }).click();
  await expect(page.locator('.native-svg svg')).toBeVisible();
  await page.getByRole('button', { name: 'Readable', exact: true }).click();
  await page.getByRole('button', { name: '|+i⟩', exact: true }).click();
  await expect(page.getByLabel('φ · Azimuthal angle value')).toHaveValue('90');
  await expect(page.getByTestId('fidelity-value')).toHaveText('0.7500');
  await page.getByLabel('Reset to ideal circuit').click();
  await expect(page.getByRole('switch', { name: 'Enable circuit noise' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('fidelity-value')).toHaveText('1.0000');
});

test('four channel selection buttons on canonical resource site q2 are functional', async ({ page }) => {
  await page.goto('/noise');
  for (const name of ['Amplitude damping', 'Phase damping', 'Depolarizing', 'Bit flip']) {
    await page.getByRole('button', { name: new RegExp(`^${name === 'Depolarizing' ? 'DEP' : name === 'Bit flip' ? 'BF' : name === 'Phase damping' ? 'PD' : 'AD'} ${name}`) }).click();
    await expect(page.getByRole('switch', { name: 'Enable circuit noise' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Noise channel', { exact: true })).toHaveValue(name === 'Bit flip' ? 'bit_flip' : name.toLowerCase().replace(' ', '_'));
  }
  // Noise is applied exclusively to q2
  await expect(page.locator('[data-testid="circuit-view"] [data-noise="true"]')).toHaveCount(1);
  await expect(page.locator('.insertion-list > div')).toHaveCount(1);
  await expect(page.getByText(/Bob['’]s Bell qubit \(q2\)/)).toBeVisible();
});

test('real average-fidelity graphs, selected table, shared sample, and CSV export', async ({ page, request }) => {
  await page.goto('/analysis');
  const table = page.getByTestId('fidelity-results-table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect(table.locator('tbody tr').nth(2).locator('td').nth(3)).toHaveText('0.75000');
  await expect(page.locator('[data-testid="fidelity-chart"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="fidelity-chart"]').first().locator('.recharts-line')).toHaveCount(4);
  await page.getByRole('button', { name: 'Amplitude damping', exact: true }).click();
  await expect(page.locator('[data-testid="fidelity-chart"]').first().locator('.recharts-line')).toHaveCount(3);
  await page.getByRole('button', { name: 'Amplitude damping', exact: true }).click();
  await page.getByLabel('State sample count').selectOption('32');
  await expect(page.getByText('32 Fibonacci points')).toBeVisible();
  const reference = await request.post('/api/sweep', { data: { sample_count: 32 } });
  const actual = await reference.json();
  await expect(table.locator('tbody tr').nth(2).locator('td').nth(1)).toHaveText(actual.table[2].channels.amplitude_damping.average_fidelity.toFixed(5));
  await expect(page.getByRole('button', { name: 'Export CSV Data' })).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV Data' }).click()]);
  const path = await download.path();
  const csv = await readFile(path!, 'utf8');
  expect(csv).toContain('haar_average_fidelity');
  expect(csv).toContain('bell_cx_q2');
  expect(csv).toContain(actual.settings.sample_id);
  expect(csv.split('\n')).toHaveLength(45);
});

test('actual zero-noise extrapolation and a high-noise non-improving case', async ({ page }) => {
  await page.goto('/mitigation');
  await expect(page.getByTestId('zne-estimate')).toHaveText('0.9920');
  await expect(page.getByText('Improved fidelity estimate', { exact: true })).toBeVisible();
  await page.getByLabel('p · Baseline noise value', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Run ZNE extrapolation', exact: true }).click();
  await expect(page.getByTestId('zne-estimate')).toHaveText('0.5000');
  await expect(page.getByText('No improvement in this regime', { exact: true })).toBeVisible();
});

test('all six pages, viva accordions, and separate architecture diagram', async ({ page }) => {
  await page.goto('/');
  for (const [label, heading] of [
    ['Circuit simulator', 'Circuit simulator'],
    ['Noise laboratory', 'Noise Laboratory'],
    ['Fidelity analysis', 'Fidelity Analysis'],
    ['Error mitigation', 'Zero-Noise Extrapolation (ZNE)'],
    ['Theory & viva', 'Theory & Viva Defense Guide'],
    ['Overview', 'Quantum Teleportation Protocol']
  ]) {
    await page.getByRole('navigation').getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Theory & viva' }).click();
  await page.getByRole('tab', { name: 'Viva Defense Questions' }).click();
  await page.getByRole('button', { name: /Why are three qubits/ }).click();
  await expect(page.getByText(/Alice’s joint Bell-state measurement has four possible orthogonal outcomes/)).toBeVisible();
  await page.getByRole('tab', { name: 'System Architecture' }).click();
  await expect(page.getByRole('img', { name: /^System architecture:/ })).toBeVisible();
});

test('backend failure displays the actual error rather than fabricated data', async ({ page }) => {
  await page.route('**/api/simulate', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'E2E deliberate backend outage' }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('E2E deliberate backend outage');
  await expect(page.getByTestId('overview-fidelity')).toHaveText('—');
  await expect(page.getByRole('alert')).toContainText('No placeholder results');
});

test('responsive mobile navigation and no document-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('overview-fidelity')).toHaveText('1.0000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Circuit simulator' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Circuit simulator' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Enable circuit noise' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
