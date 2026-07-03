/**
 * Target Chase — feature extraction
 * Traceability: GAME-06, GAME-FR-010, SRS Section 4.6
 *
 * Signals per SRS Section 4.6:
 * - commission_rate (impulsivity)
 * - omission_rate (inattention)
 * - RT variability across trials
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface TargetChaseFeatures {
    target_chase_commission_rate: number | null;    // false-alarm rate (impulsivity)
    target_chase_omission_rate: number | null;      // miss rate (inattention)
    target_chase_mean_rt_ms: number | null;
    target_chase_rt_variability: number | null;     // key ADHD-H/I signal
    target_chase_rt_trend: number | null;
    target_chase_total_trials: number | null;
    target_chase_go_ratio: number | null;           // verify 70/30 AC
    target_chase_d_prime: number | null;            // signal detection theory measure
}

export function extractTargetChaseFeatures(events: GameEvent[]): TargetChaseFeatures {
    const hits = events.filter((e) => (e.metadata as { outcome?: string })?.outcome === 'hit');
    const misses = events.filter((e) => (e.metadata as { outcome?: string })?.outcome === 'miss');
    const falseAlarms = events.filter((e) => (e.metadata as { outcome?: string })?.outcome === 'false-alarm');
    const correctRejections = events.filter((e) => (e.metadata as { outcome?: string })?.outcome === 'correct-rejection');

    const goTrials = hits.length + misses.length;
    const noGoTrials = falseAlarms.length + correctRejections.length;
    const total = goTrials + noGoTrials;

    if (total === 0) return nullFeatures();

    const commissionRate = noGoTrials > 0 ? falseAlarms.length / noGoTrials : null;
    const omissionRate = goTrials > 0 ? misses.length / goTrials : null;

    const rts = hits.map((e) => e.response_latency_ms).filter((r): r is number => r !== null && r !== undefined && r > 0);
    const meanRt = rts.length > 0 ? rts.reduce((s, v) => s + v, 0) / rts.length : null;
    const rtVar = rts.length > 1 && meanRt !== null
        ? Math.sqrt(rts.map((v) => (v - meanRt) ** 2).reduce((s, v) => s + v, 0) / rts.length) : null;
    const rtTrend = rts.length >= 3 ? linearSlope(rts) : null;

    const goRatio = total > 0 ? goTrials / total : null;

    // d' (signal detection theory): sensitivity index
    const hitRate = goTrials > 0 ? Math.max(0.01, Math.min(0.99, hits.length / goTrials)) : null;
    const faRate = noGoTrials > 0 ? Math.max(0.01, Math.min(0.99, falseAlarms.length / noGoTrials)) : null;
    const dPrime = hitRate !== null && faRate !== null
        ? normInv(hitRate) - normInv(faRate) : null;

    return {
        target_chase_commission_rate: commissionRate,
        target_chase_omission_rate: omissionRate,
        target_chase_mean_rt_ms: meanRt,
        target_chase_rt_variability: rtVar,
        target_chase_rt_trend: rtTrend,
        target_chase_total_trials: total,
        target_chase_go_ratio: goRatio,
        target_chase_d_prime: dPrime,
    };
}

function nullFeatures(): TargetChaseFeatures {
    return { target_chase_commission_rate: null, target_chase_omission_rate: null, target_chase_mean_rt_ms: null, target_chase_rt_variability: null, target_chase_rt_trend: null, target_chase_total_trials: null, target_chase_go_ratio: null, target_chase_d_prime: null };
}

function linearSlope(v: number[]): number {
    const n = v.length, xm = (n - 1) / 2, ym = v.reduce((s, x) => s + x, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (v[i]! - ym); den += (i - xm) ** 2; }
    return den === 0 ? 0 : num / den;
}

/** Approximation of inverse normal CDF (for d') */
function normInv(p: number): number {
    // Abramowitz & Stegun approximation
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pLow = 0.02425, pHigh = 1 - pLow;
    let q: number, r: number;
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[1]! * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) * q + c[6]!) /
            ((((d[1]! * q + d[2]!) * q + d[3]!) * q + d[4]!) * q + 1);
    } else if (p <= pHigh) {
        q = p - 0.5; r = q * q;
        return (((((a[1]! * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * r + a[6]!) * q /
            (((((b[1]! * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + b[5]!) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[1]! * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) * q + c[6]!) /
            ((((d[1]! * q + d[2]!) * q + d[3]!) * q + d[4]!) * q + 1);
    }
}
