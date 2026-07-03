/**
 * AgeNormalizer — z-score normalization of features against age-specific norms
 * Traceability: GAME-FR-011
 *
 * "Each feature is z-score normalized against age-specific norms
 *  (z = (value - age_mean) / age_std) from a normative database tabulated at
 *  0.5-year increments, interpolating between points; features are left
 *  unnormalized with a flag if norms aren't yet available for that age/feature."
 */

/** Single normative entry: mean and std_dev for one feature at one age band */
export interface NormativeEntry {
    age_months_min: number;
    age_months_max: number;
    feature_name: string;
    mean: number;
    std_dev: number;
    is_available: boolean;
}

/** Normative database (loaded from /api/normative or offline cache) */
export type NormativeDatabase = NormativeEntry[];

export type NormalizedFeature = number | null;

export interface NormalizationResult {
    normalized: NormalizedFeature;
    /** true if norms were available; false if left unnormalized per GAME-FR-011 */
    norms_available: boolean;
    mean_used?: number;
    std_dev_used?: number;
}

export class AgeNormalizer {
    private readonly normdb: NormativeDatabase;

    constructor(normdb: NormativeDatabase) {
        this.normdb = normdb;
    }

    /**
     * Normalize a single feature value using z-score with linear interpolation
     * for ages between 0.5-year increments.
     * GAME-FR-011: "interpolating between points"
     */
    normalize(featureName: string, rawValue: number, ageMonths: number): NormalizationResult {
        const params = this.lookupNorms(featureName, ageMonths);

        if (!params || !params.is_available) {
            // GAME-FR-011: "features are left unnormalized with a flag if norms aren't yet available"
            return { normalized: null, norms_available: false };
        }

        const z = (rawValue - params.mean) / params.std_dev;
        return {
            normalized: z,
            norms_available: true,
            mean_used: params.mean,
            std_dev_used: params.std_dev,
        };
    }

    /**
     * Normalize an entire feature record.
     * Returns Record<string, number | null> where null means norms unavailable.
     * GAME-FR-011: null-flagged, not zeroed.
     */
    normalizeAll(
        features: Record<string, number>,
        ageMonths: number,
    ): Record<string, number | null> {
        const result: Record<string, number | null> = {};
        for (const [name, value] of Object.entries(features)) {
            const norm = this.normalize(name, value, ageMonths);
            result[name] = norm.normalized;
        }
        return result;
    }

    /**
     * Look up or interpolate normative parameters for a feature at a given age.
     * GAME-FR-011: "tabulated at 0.5-year increments, interpolating between points"
     */
    private lookupNorms(
        featureName: string,
        ageMonths: number,
    ): { mean: number; std_dev: number; is_available: boolean } | null {
        const relevant = this.normdb.filter((e) => e.feature_name === featureName);
        if (relevant.length === 0) return null;

        // Find the entry whose band contains the age
        const exact = relevant.find(
            (e) => ageMonths >= e.age_months_min && ageMonths < e.age_months_max,
        );

        if (exact) {
            return { mean: exact.mean, std_dev: exact.std_dev, is_available: exact.is_available };
        }

        // Interpolate between adjacent bands
        // Sort by age_months_min
        const sorted = [...relevant].sort((a, b) => a.age_months_min - b.age_months_min);

        // Find surrounding entries for linear interpolation
        let lower: NormativeEntry | null = null;
        let upper: NormativeEntry | null = null;

        for (const entry of sorted) {
            if (entry.age_months_min <= ageMonths) lower = entry;
            if (entry.age_months_min > ageMonths && upper === null) upper = entry;
        }

        if (!lower && !upper) return null;
        if (!lower) return { mean: upper!.mean, std_dev: upper!.std_dev, is_available: upper!.is_available };
        if (!upper) return { mean: lower.mean, std_dev: lower.std_dev, is_available: lower.is_available };

        // Both not available → return unavailable
        if (!lower.is_available || !upper.is_available) {
            return { mean: 0, std_dev: 1, is_available: false };
        }

        // Linear interpolation
        const t =
            (ageMonths - lower.age_months_min) /
            (upper.age_months_min - lower.age_months_min);

        const interpMean = lower.mean + t * (upper.mean - lower.mean);
        const interpStd = lower.std_dev + t * (upper.std_dev - lower.std_dev);

        return { mean: interpMean, std_dev: Math.max(interpStd, 0.001), is_available: true };
    }
}
