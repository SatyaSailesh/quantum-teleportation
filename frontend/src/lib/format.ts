import type { Complex, SweepResult } from './types';

export function formatComplex(value: Complex, precision = 4): string {
  const re = Math.abs(value.re) < 0.5 * 10 ** -precision ? 0 : value.re;
  const im = Math.abs(value.im) < 0.5 * 10 ** -precision ? 0 : value.im;
  if (im === 0) return re.toFixed(precision);
  if (re === 0) return `${im.toFixed(precision)}i`;
  return `${re.toFixed(precision)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(precision)}i`;
}
export const f4 = (value: number | undefined) => value === undefined ? '—' : value.toFixed(4);
export const degrees = (radians: number) => radians * 180 / Math.PI;
export const radians = (angle: number) => angle * Math.PI / 180;
export function downloadText(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function sweepCsv(result: SweepResult): string {
  const headers = ['p', 'channel', 'average_fidelity', 'haar_average_fidelity', 'input_state_fidelity', 'min_fidelity', 'max_fidelity', 'sample_count', 'sample_id', 'locations', 'theta_radians', 'phi_radians'];
  const rows = result.points.flatMap(point => result.settings.channels.map(channel => {
    const stats = point.channels[channel];
    return [point.p, channel, stats.average_fidelity, stats.haar_average_fidelity, stats.state_fidelity, stats.minimum, stats.maximum,
      result.settings.sample_count, result.settings.sample_id, result.settings.locations.join(';'), result.settings.theta, result.settings.phi];
  }));
  return [headers, ...rows].map(row => row.map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\n');
}
