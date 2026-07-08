/**
 * Report generation service
 * Traceability: REPORT-FR-001/002/003/004, CON-REG-004, CON-ETH-001, SRS §8.5
 *
 * Pipeline: ML predictions + SHAP values → Gemini API → Amharic report text
 * Fallback: pre-generated templates when Gemini unavailable (SRS §2.4.5)
 * CON-REG-004: Every report MUST state "This is a screening, not a diagnosis."
 * CON-ETH-001: No diagnostic claims — risk scores only, never labels.
 */

import { z } from 'zod';

import type { LearningCondition, Language } from '@earlymind/shared-types';

import { env } from '../../config/env';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';
import { geminiClient } from '../../integrations/geminiClient';
import { s3Client } from '../../integrations/s3Client';

// ─── CON-REG-004: Disclaimer strings per language (MANDATORY in every report) ──

/** CON-REG-004: must appear verbatim in every report */
export const DISCLAIMER: Record<Language, string> = {
  am: 'ይህ ምርመራ ነው፣ ሕክምናዊ ምርመራ አይደለም። ለዝርዝር ምርመራ ሙያዊ ባለሙያ ያማክሩ።',
  om: 'Kun madaallii malee dhukkuba mirkaneessuu miti. Qorannoo dabalataa argachuuf ogeessa dubbisiisaa.',
  ti: 'እዚ ምርመራ እዩ፣ ናይ ሕክምና መርመራ ኣይኮነን። ንዝርዝር ምርመራ ክኢላ ምኽሪ ሕተቱ።',
};

// ─── IERC contact information (SRS §1.4.1 — referral recommendation) ──────────
const IERC_CONTACT = {
  am: 'ለቅርብ ኢ.ኢ.ር.ሲ (Ethiopian Inclusive Education Resource Center) ያነጋግሩ።',
  om: 'IERC (Jijjiirraa Barnoota Hammatamaaf Giddu Gala) dhiyoo jiru quunnamaa.',
  ti: 'ቀረባ IERC (Ethiopian Inclusive Education Resource Center) ተወከሱ።',
};

// ─── Risk level thresholds (for plain-language explanations) ──────────────────
// CON-ETH-001: never use binary diagnosis language — use descriptive levels only
const RISK_LEVELS = {
  LOW: { max: 0.35, label: { am: 'ዝቅተኛ', om: 'Xiqqaa', ti: 'ትሑት' } },
  MODERATE: { max: 0.65, label: { am: 'መካከለኛ', om: 'Giddugaleessa', ti: 'ማእከላይ' } },
  HIGH: { max: 1.0, label: { am: 'ከፍተኛ', om: 'Ol aanaa', ti: 'ልዑል' } },
};

// ─── Condition names per language (CON-CULT-005: no stigmatizing language) ────
const CONDITION_LABELS: Record<LearningCondition, Record<Language, string>> = {
  dyslexia: {
    am: 'የንባብ ችግር',
    om: 'Rakkoo Dubbisuu',
    ti: 'ጸገም ምንባብ',
  },
  dyscalculia: {
    am: 'የሂሳብ ትምህርት ችሎታ',
    om: 'Dandeettii Barnoota Herregaa',
    ti: 'ክእለት ትምህርቲ ሂሳብ',
  },
  adhd_inattentive: {
    am: 'የትኩረት ሁኔታ',
    om: 'Haala Xiyyeeffannaa',
    ti: 'ኩነታት ኣቕልቦ',
  },
  adhd_hyperactive_impulsive: {
    am: 'የእንቅስቃሴ ሁኔታ',
    om: 'Haala Sochii',
    ti: 'ኩነታት ምንቅስቃስ',
  },
  working_memory_deficit: {
    am: 'የዕለታዊ ትምህርት ሂደት',
    om: 'Deemsa Barnoota Guyyaa Guyyaa',
    ti: 'ሂደት መዓልታዊ ትምህርቲ',
  },
  processing_speed_deficit: {
    am: 'የምላሽ ፍጥነት',
    om: 'Saffisa Deebii',
    ti: 'ፍጥነት ምላሽ',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictionInput {
  condition: LearningCondition;
  risk_score: number;
  confidence: number;
  shap_top_features: string[];
}

export interface GeneratedReport {
  report_text_amharic: string;
  recommendations: string[];
  referral_suggested: boolean;
  disclaimer: string;
}

// ─── Main report generation ───────────────────────────────────────────────────

/**
 * Generate a plain-language Amharic report using Gemini API.
 * Falls back to templates if Gemini unavailable (SRS §2.4.5 fallback).
 * CON-REG-004: disclaimer always included.
 * CON-ETH-001: no diagnostic claims.
 * REPORT-FR-001, REPORT-FR-002
 */
export async function generateReport(
  sessionId: string,
  childAgeMonths: number,
  predictions: PredictionInput[],
  language: Language = 'am',
): Promise<GeneratedReport> {
  // Check for referral threshold (any condition risk > 0.6)
  const referralSuggested = predictions.some((p) => p.risk_score > 0.6);

  let reportText: string;
  let recommendations: string[];

  if (env.GEMINI_API_KEY) {
    // REPORT-FR-001: Gemini-generated report
    try {
      ({ reportText, recommendations } = await generateWithGemini(
        predictions,
        childAgeMonths,
        language,
        referralSuggested,
      ));
    } catch (err) {
      console.error('Gemini report generation failed, using template fallback:', err);
      ({ reportText, recommendations } = generateFromTemplate(
        predictions, childAgeMonths, language, referralSuggested,
      ));
    }
  } else {
    // REPORT-FR-002: Template fallback
    ({ reportText, recommendations } = generateFromTemplate(
      predictions, childAgeMonths, language, referralSuggested,
    ));
  }

  // CON-REG-004: disclaimer ALWAYS appended — never omit
  const disclaimer = DISCLAIMER[language];
  const fullText = `${reportText}\n\n---\n${disclaimer}`;

  return {
    report_text_amharic: fullText,
    recommendations,
    referral_suggested: referralSuggested,
    disclaimer,
  };
}

// ─── Gemini integration (REPORT-FR-001) ──────────────────────────────────────

async function generateWithGemini(
  predictions: PredictionInput[],
  ageMonths: number,
  language: Language,
  referralSuggested: boolean,
): Promise<{ reportText: string; recommendations: string[] }> {
  const ageYears = Math.floor(ageMonths / 12);
  const ageMonthsRem = ageMonths % 12;

  // Build concise summary for Gemini (SRS §8.5: SHAP values in)
  const predictionSummary = predictions.map((p) => {
    const level = getRiskLevel(p.risk_score);
    const condLabel = CONDITION_LABELS[p.condition][language];
    const topFeaturesSummary = p.shap_top_features.slice(0, 3).join(', ');
    return `- ${condLabel}: ${level.label[language]} (${(p.risk_score * 100).toFixed(0)}% — key signals: ${topFeaturesSummary})`;
  }).join('\n');

  // CON-CULT-005: no stigmatizing language; CON-ETH-001: no diagnostic claims
  const prompt = `You are an educational support specialist writing a SCREENING report in ${getLanguageName(language)} for parents.

IMPORTANT RULES:
1. This is a SCREENING only — never use words like "diagnosis", "disorder", "disability"
2. Use warm, supportive, jargon-free language suitable for parents
3. Focus on what support can help the child at school
4. Child age: ${ageYears} years ${ageMonthsRem > 0 ? `${ageMonthsRem} months` : ''}

SCREENING RESULTS (risk indicators from a 20-minute play-based assessment):
${predictionSummary}

Write:
1. A 2-3 sentence summary of what the screening found (using plain language, no medical terms)
2. 3-4 specific classroom support suggestions that teachers can use immediately
${referralSuggested ? '3. A gentle recommendation to speak with a learning support specialist' : ''}

Respond ONLY in ${getLanguageName(language)}.`;

  const text = await geminiClient.generateText(prompt);

  // Extract recommendations (lines starting with numbered list)
  const lines = text.split('\n').filter((l) => l.trim());
  const recommendations = lines
    .filter((l) => /^[0-9]+\./.test(l.trim()) || l.trim().startsWith('-'))
    .slice(0, 5)
    .map((l) => l.replace(/^[0-9]+\.\s*|-\s*/, '').trim());

  return { reportText: text, recommendations };
}

// ─── Template fallback (REPORT-FR-002) ───────────────────────────────────────

function generateFromTemplate(
  predictions: PredictionInput[],
  ageMonths: number,
  language: Language,
  referralSuggested: boolean,
): { reportText: string; recommendations: string[] } {
  const ageYears = Math.floor(ageMonths / 12);
  const highRisk = predictions.filter((p) => p.risk_score > 0.6);
  const modRisk = predictions.filter((p) => p.risk_score > 0.35 && p.risk_score <= 0.6);

  // Template texts per language
  const templates = {
    am: {
      intro: `ይህ ሪፖርት ለ${ageYears} ዓመት ልጅዎ የተደረገ የ20 ደቂቃ ጨዋታ-ላይ-ተመርኩዞ ምርመራ ውጤት ነው።`,
      highRiskNote: highRisk.length > 0
        ? `ምርመራው ${highRisk.map((p) => CONDITION_LABELS[p.condition].am).join(', ')} ዘርፎች ላይ ተጨማሪ ድጋፍ ሊያስፈልግ ስለሚችል ያሳያል።`
        : '',
      modRiskNote: modRisk.length > 0
        ? `${modRisk.map((p) => CONDITION_LABELS[p.condition].am).join(', ')} ዘርፎች ላይ ቀስ በቀስ ክትትል ማድረግ ይረዳል።`
        : '',
      lowRiskNote: highRisk.length === 0 && modRisk.length === 0
        ? 'ምርመራው ልጅዎ ጥሩ ተሳትፎ ማሳየቱን ያሳያል። ቀጣይ ድጋፍ ይቀጥሉ።'
        : '',
      referral: referralSuggested
        ? `${IERC_CONTACT.am}`
        : '',
    },
    om: {
      intro: `Gabaasni kun daa'ima kee/keetii waggoota ${ageYears} qorannoo daqiiqaa 20 taphaatti hundaa'e irraa argameedha.`,
      highRiskNote: highRisk.length > 0
        ? `Qorannoon ${highRisk.map((p) => CONDITION_LABELS[p.condition].om).join(', ')} irratti deeggarsi dabalataa barbaachisuu mala agarsiisa.`
        : '',
      modRiskNote: modRisk.length > 0
        ? `${modRisk.map((p) => CONDITION_LABELS[p.condition].om).join(', ')} irratti hordoffiin cimaa gargaaruu danda'a.`
        : '',
      lowRiskNote: highRisk.length === 0 && modRisk.length === 0
        ? 'Qorannoon daa'imni kee/keetii hirmaannaa gaarii agarsiisuu agarsiisa. Deeggarsa itti fufi.'
        : '',
      referral: referralSuggested ? IERC_CONTACT.om : '',
    },
    ti: {
      intro: `እዚ ጸብጻብ ንቆልዓካ/ኪ ${ageYears} ዓመት ናይ 20 ደቓይቕ ምርመራ ሳዕቤን እዩ።`,
      highRiskNote: highRisk.length > 0
        ? `ምርመራ ${highRisk.map((p) => CONDITION_LABELS[p.condition].ti).join(', ')} ዘርፊ ተወሳኺ ሓገዝ ከድልዮ ይኽእል ምዃኑ የርኢ።`
        : '',
      modRiskNote: modRisk.length > 0
        ? `${modRisk.map((p) => CONDITION_LABELS[p.condition].ti).join(', ')} ዘርፊ ምክትታል ክሕግዝ ይኽእል።`
        : '',
      lowRiskNote: highRisk.length === 0 && modRisk.length === 0
        ? 'ምርመራ ቆልዓካ/ኪ ጽቡቕ ተሳትፎ ምርኣዩ የርኢ። ሓገዝ ቀጽሉ።'
        : '',
      referral: referralSuggested ? IERC_CONTACT.ti : '',
    },
  };

  const t = templates[language];
  const parts = [t.intro, t.highRiskNote, t.modRiskNote, t.lowRiskNote, t.referral]
    .filter(Boolean);
  const reportText = parts.join('\n\n');

  // Generic classroom recommendations
  const recommendations = buildRecommendations(predictions, language);

  return { reportText, recommendations };
}

function buildRecommendations(
  predictions: PredictionInput[],
  language: Language,
): string[] {
  const recs: string[] = [];

  // Map conditions to plain-language classroom accommodations
  const accommodations: Partial<Record<LearningCondition, Record<Language, string>>> = {
    dyslexia: {
      am: 'ለልጅዎ ዓይነ-ዕውር ሳይሆን ድምፅ ያለው ንባብ ቁሳቁሶችን ይጠቀሙ',
      om: 'Daa\'imaniif meeshaalee sagalee qabu bitaa',
      ti: 'ንቆልዓካ/ኪ ናይ ድምጺ ሃብቲ ምንባብ ተጠቐሙ',
    },
    dyscalculia: {
      am: 'ቁጥር ሲማሩ ዕቃዎችን (ድንጋዮ፣ ዘሮ) ይጠቀሙ',
      om: 'Lakkoofsa barsiisaa yeroo meeshaalee fayyadamuu',
      ti: 'ቁጽሪ ክትምህሩ ከለኹም ቁሳቁስ ተጠቐሙ',
    },
    adhd_inattentive: {
      am: 'አጫጭር ተግባሮች እና ዕረፍቶች ያስፈልጋሉ',
      om: 'Hojii gabaabaa fi boqonnaa barbaachisu',
      ti: 'ሓጸርቲ ስርሓት ፡ ዕረፍቲ ኣካቱ',
    },
    adhd_hyperactive_impulsive: {
      am: 'ልጅዎ ተንቀሳቃሽ ተግባሮች ይጠቀሙ',
      om: 'Hojii sochii of keessatti qabate fayyadami',
      ti: 'ንቕሱ ንጥፈታት ተጠቐሙ',
    },
    working_memory_deficit: {
      am: 'ለልጅዎ ዝርዝር ዕቅዶችን ይሰጡ',
      om: 'Daa\'imaniif tarree hojii kaa\'aa kennii',
      ti: 'ንቆልዓካ/ኪ ዝርዝር ዝርዝር ሃቡ',
    },
    processing_speed_deficit: {
      am: 'ለልጅዎ ተጨማሪ ጊዜ ይስጡ',
      om: 'Daa\'imaniif yeroo dabalataa kennii',
      ti: 'ንቆልዓካ/ኪ ዝተወሰኸ ግዜ ሃቡ',
    },
  };

  const highOrMod = predictions.filter((p) => p.risk_score > 0.35);
  for (const pred of highOrMod) {
    const acc = accommodations[pred.condition];
    if (acc) recs.push(acc[language]);
  }

  return recs.length > 0 ? recs : [
    { am: 'ልጅዎን ይከታተሉ እና ይደግፉ።', om: 'Daa\'ima kee/keetii hordofii deeggarsa kennii.', ti: 'ቆልዓካ/ኪ ክትታሉ ሓዙ።' }[language],
  ];
}

function getRiskLevel(score: number) {
  if (score <= RISK_LEVELS.LOW.max) return RISK_LEVELS.LOW;
  if (score <= RISK_LEVELS.MODERATE.max) return RISK_LEVELS.MODERATE;
  return RISK_LEVELS.HIGH;
}

function getLanguageName(lang: Language): string {
  return { am: 'Amharic (አማርኛ)', om: 'Afaan Oromoo', ti: 'Tigrinya (ትግርኛ)' }[lang];
}

// ─── Report retrieval and PDF generation (REPORT-FR-003) ─────────────────────

/**
 * Get report for a session, generating it if not yet ready.
 * CON-REG-004: disclaimer always in every returned report.
 */
export async function getReport(sessionId: string, requestingUserId: string) {
  // Verify ownership
  const { rows: sessionRows } = await db.query<{
    status: string; child_id: string; language: string;
  }>(
    `SELECT s.status, s.child_id, s.language
     FROM sessions s
     JOIN children c ON c.child_id = s.child_id
     WHERE s.session_id = $1
       AND (c.parent_id = $2 OR c.teacher_id = $2)`,
    [sessionId, requestingUserId],
  );

  if (!sessionRows[0]) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found or access denied.');
  }

  const { rows: reportRows } = await db.query<{
    report_id: string;
    generation_status: string;
    report_text_amharic: string | null;
    recommendations: string[] | null;
    referral_suggested: boolean;
    pdf_s3_key: string | null;
    generated_at: Date | null;
  }>(
    `SELECT report_id, generation_status, report_text_amharic,
            recommendations, referral_suggested, pdf_s3_key, generated_at
     FROM reports WHERE session_id = $1`,
    [sessionId],
  );

  const report = reportRows[0];

  if (!report || report.generation_status === 'pending') {
    // GAME-FR-004: "Report will be ready in 1-2 minutes"
    return {
      status: 'pending',
      message: DISCLAIMER[sessionRows[0].language as Language] + '\n\n' +
        { am: 'ሪፖርቱ ከ1-2 ደቂቃ ውስጥ ዝጋጅ ይሆናል።', om: 'Gabaasni daqiiqaa 1-2 keessatti ni dhufa.', ti: 'ጸብጻብ ኣብ ውሽጢ 1-2 ደቓይቕ ክዳሎ እዩ።' }[sessionRows[0].language as Language],
    };
  }

  // Generate signed S3 URL for PDF (REPORT-FR-003)
  let pdfUrl: string | null = null;
  if (report.pdf_s3_key) {
    pdfUrl = await s3Client.getSignedUrl(report.pdf_s3_key, 3600);
  }

  return {
    status: 'completed',
    report_id: report.report_id,
    report_text_amharic: report.report_text_amharic,
    recommendations: report.recommendations ?? [],
    referral_suggested: report.referral_suggested,
    pdf_url: pdfUrl,
    generated_at: report.generated_at?.toISOString(),
    // CON-REG-004: disclaimer always in API response
    disclaimer: DISCLAIMER[sessionRows[0].language as Language],
  };
}
