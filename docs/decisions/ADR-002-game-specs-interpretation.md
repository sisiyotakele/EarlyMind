# ADR-002: Game Specification Interpretation (Section 4 vs Appendix D)

**Date:** 2026-07-03  
**Status:** Accepted  
**Traceability:** GAME-01 through GAME-07, SRS Section 4, SRS Appendix D

## Context

SRS Section 4 body text for games 4.1–4.5 appears to repeat the same content in the condensed document. However, Appendix D provides the authoritative game → construct → LD-target mapping table. Section 4.6 (Target Chase) and 4.7 (Word Echo) have correct full specs.

## Decision

We use **Appendix D as the authoritative source** for LD targets and constructs, and derive gameplay mechanics from the body description in Section 4.1 (selective attention with colored tiles + adaptive difficulty), which maps correctly to **Color Sequence** per Appendix D. The seven games are implemented as follows:

| # | Game ID | Construct (Appendix D) | LD Target (Appendix D) | Difficulty | Key Mechanic |
|---|---------|----------------------|------------------------|------------|--------------|
| 1 | letter-rain | Phonological awareness, letter-sound recognition | Dyslexia, Processing Speed Deficit | Adaptive | Letters fall from top; child taps matching target letters |
| 2 | pattern-mirror | Visual working memory, sequence recall | Working Memory Deficit, Dyscalculia | Fixed curve (SRS GAME-FR-007: Pattern Mirror uses fixed) | Pattern shown then hidden; child replicates it |
| 3 | story-rhythm | Auditory processing, rhythmic sync | Dyslexia, ADHD-Inattentive | Fixed rhythm BPM with adaptive complexity | Child taps along to a spoken-word rhythm |
| 4 | number-jumper | Numerical cognition, number sense | Dyscalculia | Adaptive | Child selects correct number or quantity |
| 5 | color-sequence | Sustained attention, short-term memory | ADHD-Inattentive, Working Memory Deficit | Adaptive | Colored tiles flash in sequence; child taps matching targets (~2:1 distractor:target, 400–800ms flash) |
| 6 | target-chase | Sustained visual attention, impulse control | ADHD-Hyperactive/Impulsive | Fixed (70/30 go/no-go, 60 trials, 800–2000ms ISI) | Go/no-go CPT task |
| 7 | word-echo | Phonological loop, verbal working memory | Dyslexia, Working Memory Deficit | Adaptive (word-list length 2–5) | Hear word list, select picture cards in order |

## Consequence

All game implementations reference this ADR. The mechanics description in SRS 4.1 (colored tiles, flash duration 400–800ms, 2:1 distractor:target) is assigned to **Color Sequence** (GAME-05) per Appendix D. Letter Rain uses letter-falling phonological mechanics consistent with its dyslexia/processing-speed target.
