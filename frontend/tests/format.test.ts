import { describe, expect, it } from 'vitest';
import { degrees, radians, f4, formatComplex } from '../src/lib/format';
import { CHANNELS, DEFAULT_CONFIG, LOCATIONS } from '../src/lib/constants';

describe('Scientific display formatting', () => {
  it('converts degrees and radians without changing input-state meaning', () => {
    expect(radians(180)).toBeCloseTo(Math.PI, 12);
    expect(degrees(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(degrees(radians(45))).toBeCloseTo(45, 12);
  });

  it('displays the complex phase and negative imaginary component correctly', () => {
    expect(formatComplex({ re: 0.5, im: -0.35355339 })).toBe('0.5000 − 0.3536i');
    expect(formatComplex({ re: 0, im: 1 })).toBe('1.0000i');
    expect(formatComplex({ re: 1, im: 0 })).toBe('1.0000');
  });

  it('removes only display-level roundoff and does not fake missing fidelity', () => {
    expect(formatComplex({ re: -1e-16, im: 0 })).toBe('0.0000');
    expect(f4(undefined)).toBe('—');
    expect(f4(.825)).toBe('0.8250');
  });

  it('starts with the ideal circuit and the single canonical resource site on q2', () => {
    expect(DEFAULT_CONFIG.noise.enabled).toBe(false);
    expect(DEFAULT_CONFIG.noise.locations).toEqual(['bell_cx_q2']);
    expect(CHANNELS).toHaveLength(4);
    expect(LOCATIONS).toHaveLength(1);
    expect(LOCATIONS[0].key).toBe('bell_cx_q2');
    expect(LOCATIONS[0].qubit).toBe(2);
  });
});
