# EarlyMind Platform - Visual Overview

**Running on:** http://localhost:5173/ (Vite dev server)  
**Tech Stack:** React 18 + TypeScript + Tailwind CSS  

---

## User Roles & Flows

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EarlyMind Platform Structure                     │
└─────────────────────────────────────────────────────────────────────┘

┌─ PARENT/GUARDIAN ─────────────────────────────────────────────────┐
│                                                                    │
│  1. Login Page (Phone + OTP/PIN)                                  │
│     └─→ Child Profile Selection                                   │
│         └─→ Pre-Assessment (consent + language select)            │
│             └─→ Game Session (plays 7 games in sequence)          │
│                 ├─ Game 1: Letter Rain (phonological)             │
│                 ├─ Game 2: Pattern Mirror (visual memory)         │
│                 ├─ Game 3: Story Rhythm (auditory)                │
│                 ├─ Game 4: Number Jumper (math cognition)         │
│                 ├─ Game 5: Color Sequence (attention)             │
│                 ├─ Game 6: Target Chase (impulse control)         │
│                 └─ Game 7: Word Echo (phonological loop)          │
│                     └─→ Report View (plain-language Amharic)      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ TEACHER ──────────────────────────────────────────────────────────┐
│                                                                    │
│  Same as Parent, PLUS:                                            │
│                                                                    │
│  Teacher Dashboard:                                               │
│  ├─ Class Roster (list of students)                               │
│  ├─ Bulk Screening (launch assessments for multiple kids)         │
│  └─ Accommodation Guide (per-child recommendations)               │
│     - NO access to raw scores (privacy)                           │
│     - Only sees classroom support suggestions                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ SCHOOL ADMIN ─────────────────────────────────────────────────────┐
│                                                                    │
│  School Admin Dashboard:                                          │
│  ├─ Aggregate Analytics (school-wide metrics)                     │
│  │  - Total children screened                                     │
│  │  - Risk distribution by condition                              │
│  │  - Screening completion rate                                   │
│  ├─ Teacher Management (invite/manage teachers)                   │
│  └─ Export Page (CSV/Excel, anonymized data only)                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌─ EAII ADMIN (Research) ────────────────────────────────────────────┐
│                                                                    │
│  EAII Admin Console (full system access):                         │
│  ├─ System Health Page                                            │
│  │  - API status, DB health, ML service status                    │
│  ├─ Model Management (upload/approve models)                      │
│  ├─ Research Export (IRB-approved data exports)                   │
│  └─ Audit Log (complete system audit trail)                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Screen Mockups

### 1. Login Screen

```
┌─────────────────────────────────────────┐
│                                         │
│         🎮 EarlyMind                    │
│                                         │
│     Early Learning Disability           │
│     Detection System                    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │ Phone Number:                  │    │
│  │ [ +251 9 XX XXX XXXX        ]  │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [ Login via OTP/PIN ]          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Language: [Amharic ▼]                 │
│                                         │
│  ✓ I agree to privacy terms            │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Child Profile Selection

```
┌──────────────────────────────────────────────┐
│ 👤 Welcome, Teacher Amara!                   │
├──────────────────────────────────────────────┤
│                                              │
│  Select a child to screen:                  │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │ 👧 Sofia (6 years old)              │   │
│  │ Last screened: 2026-07-01           │   │
│  │ [ Start Assessment ]                │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │ 👦 Abebe (5 years old)              │   │
│  │ Never screened                      │   │
│  │ [ Start Assessment ]                │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │ 👧 Hamdiya (7 years old)            │   │
│  │ Last screened: 2026-06-15           │   │
│  │ [ Start Assessment ]                │   │
│  └─────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

### 3. Game Session (Letter Rain Example)

```
┌──────────────────────────────────────────────┐
│ Game 1/7: Letter Rain 🌧️                     │
├──────────────────────────────────────────────┤
│                                              │
│  Watch the letters fall, tap them to catch! │
│                                              │
│  Score: 23/30                               │
│  Time: 1:45 / 2:00                          │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │              ⭕ (touch target 48px)  │   │
│  │             /  \                     │   │
│  │            /    \                    │   │
│  │           ⭕    ⭕  (falling letters) │   │
│  │          /   \  / \                  │   │
│  │         /     ⭕   \                 │   │
│  │                                      │   │
│  │         ☐ ☐ ☐ ☐ ☐ (basket)         │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  🔊 Audio instructions (in selected lang)  │
│                                              │
│  [ 🏠 Pause ] [ × Exit ]  [ ✓ Done ]       │
│                                              │
└──────────────────────────────────────────────┘
```

### 4. Report View (Parent Report)

```
┌────────────────────────────────────────────┐
│ 📊 Sofia's Screening Report                │
├────────────────────────────────────────────┤
│                                            │
│ የብርሕታ ምርመራ ውጤት                      │
│ Sofia - 6 ዓመት - 2026-07-08                │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ ሪፖርት:                                    │
│                                            │
│ ሪፖርቱ በ 20 ደቂቃ የተደረገ ጨዋታ-ላይ-ተመርኩዞ  │
│ ምርመራ ውጤት ነው።                        │
│                                            │
│ ምርመራው Sofia ልጃችሁ ጥሩ ተሳትፎ ማሳየቱን   │
│ ያሳያል። ቀጣይ ድጋፍ ይቀጥሉ።               │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ ቅሬታዎች:                                 │
│ • ለልጆ ትናንሽ ተግባሮች ይስጡ             │
│ • ተጨማሪ ጊዜ ይስጡ                       │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ ⚠️  ይህ ምርመራ ነው፣ ሕክምናዊ ምርመራ      │
│ አይደለም። ለዝርዝር ምርመራ ሙያዊ ባለሙያ       │
│ ያማክሩ።                                  │
│                                            │
│ [ 📥 Download PDF ]  [ 📧 Share ]         │
│                                            │
└────────────────────────────────────────────┘
```

### 5. Teacher Dashboard - Class Roster

```
┌────────────────────────────────────────────┐
│ 🏫 Class Roster - Grade 1A                 │
├────────────────────────────────────────────┤
│                                            │
│ Quick Actions:                             │
│ [ 🚀 Bulk Screening ] [ 📋 Guidance ]     │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ Students (12):                             │
│                                            │
│ ☑️  Sofia         | Screened | View Guide │
│ ☐   Abebe         | Pending  | Start     │
│ ☑️  Hamdiya       | Screened | View Guide│
│ ☐   Tewodros      | Never    | Start     │
│ ☑️  Almaz         | Screened | View Guide│
│ ...                                        │
│                                            │
│ Screening Status:                          │
│ ✓ Complete: 7/12                          │
│ ⏳ In Progress: 2/12                      │
│ ○ Not Started: 3/12                       │
│                                            │
└────────────────────────────────────────────┘
```

### 6. Teacher Dashboard - Accommodation Guide

```
┌────────────────────────────────────────────┐
│ 🎯 Accommodation Guide - Sofia              │
├────────────────────────────────────────────┤
│                                            │
│ Recommended classroom support:             │
│                                            │
│ 📖 Reading:                                │
│ • Use audio books and voice recordings     │
│ • Provide texts in larger font             │
│ • Allow extra time for reading tasks       │
│                                            │
│ 🔢 Math:                                   │
│ • Use manipulatives (blocks, counters)     │
│ • Break problems into smaller steps        │
│ • Provide graph paper for organization     │
│                                            │
│ ⚠️  IMPORTANT:                             │
│ This is confidential guidance only for     │
│ classroom use. Do NOT share raw data.      │
│ Last updated: 2026-07-01                   │
│                                            │
│ 📞 Questions? Contact your school admin    │
│                                            │
│ [ Print ] [ Back ]                        │
│                                            │
└────────────────────────────────────────────┘
```

### 7. School Admin - Aggregate Analytics

```
┌────────────────────────────────────────────┐
│ 📊 School Analytics Dashboard              │
├────────────────────────────────────────────┤
│                                            │
│ Addis Academy - 2026-07-08                 │
│                                            │
│ Total Students: 250                        │
│ Screened: 180 (72%)                        │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ Risk Distribution:                         │
│                                            │
│ ░░░░░ Dyslexia        38 (21%)             │
│ ░░░░░ ADHD            25 (14%)             │
│ ░░░░░ Dyscalculia     18 (10%)             │
│ ░░░░░ Working Memory  22 (12%)             │
│ ░░░░░ Low Risk        77 (43%)             │
│                                            │
│ ─────────────────────────────────────────  │
│                                            │
│ Completion Rate by Grade:                  │
│ Grade 1: 85% | Grade 2: 78% | Grade 3: 62%│
│                                            │
│ [ 📥 Export Data ]  [ 📧 Send Report ]    │
│                                            │
└────────────────────────────────────────────┘
```

---

## Key Features by Screen

### ✅ Assessment Flow

| Screen | Features |
|--------|----------|
| **Login** | Phone + OTP/PIN, language selection, offline support |
| **Child Profile** | Select child, age display, previous screening history |
| **Pre-Assessment** | Consent acknowledgment, parent/teacher choice, confirm language |
| **Game Session** | 7 sequential games (20 min total), touch/click input, audio guidance, pause/resume, skip links |
| **Report View** | Plain-language Amharic, recommendations, disclaimer, PDF download |

### ✅ Teacher Dashboard

| Screen | Features |
|--------|----------|
| **Class Roster** | Student list, screening status, quick start, bulk screening |
| **Accommodation Guide** | Per-child recommendations, NO raw data shown, confidentiality notice |

### ✅ School Admin Dashboard

| Screen | Features |
|--------|----------|
| **Analytics** | School-wide metrics, risk distribution charts, completion rates |
| **Teacher Management** | Invite/remove teachers, role assignment |
| **Export** | CSV/Excel export (anonymized), compliance-ready |

### ✅ EAII Admin Console

| Screen | Features |
|--------|----------|
| **System Health** | API/DB/ML service status, uptime, latency |
| **Model Management** | Upload model, approve for production |
| **Research Export** | IRB-approved data, audit trail, consent tracking |
| **Audit Log** | Complete system activity log, filterable |

---

## Game Examples

### Game 1: Letter Rain 🌧️
- **Purpose:** Phonological awareness, processing speed
- **Interaction:** Tap letters as they fall
- **Difficulty:** Increases with successful catches
- **Target:** 48px touch targets

### Game 2: Pattern Mirror 🪞
- **Purpose:** Visual working memory
- **Interaction:** Repeat shown color patterns
- **Difficulty:** Length of pattern increases
- **Target:** Multi-color sequences

### Game 3: Story Rhythm 🎵
- **Purpose:** Auditory processing
- **Interaction:** Tap to beat of story
- **Difficulty:** Tempo increases
- **Target:** Audio + timing coordination

### Game 4: Number Jumper 🦘
- **Purpose:** Numerical cognition
- **Interaction:** Jump to target numbers
- **Difficulty:** Range of numbers increases
- **Target:** Math pattern recognition

### Game 5: Color Sequence 🎨
- **Purpose:** Sustained attention
- **Interaction:** Tap matching colors in sequence
- **Difficulty:** Sequence length increases
- **Target:** Memory + attention span

### Game 6: Target Chase 🎯
- **Purpose:** Impulse control, motor planning
- **Interaction:** Chase moving target
- **Difficulty:** Speed increases
- **Target:** Motor coordination (60 trials, 70/30 accuracy tracking)

### Game 7: Word Echo 🔊
- **Purpose:** Phonological loop
- **Interaction:** Repeat spoken words
- **Difficulty:** Word length increases (2-5 words)
- **Target:** Auditory recall

---

## Technical Implementation

```
React 18 (TypeScript)
├─ Routes
│  ├─ /login (LoginPage)
│  ├─ /assessment (ChildProfile, PreAssessment, GameSession, ReportView)
│  ├─ /teacher (ClassRoster, BulkScreening, AccommodationGuide)
│  ├─ /school-admin (Analytics, TeacherManagement, Export)
│  └─ /eaii-admin (SystemHealth, ModelManagement, ResearchExport, AuditLog)
│
├─ Games (React Components, 7 games)
│  ├─ LetterRain.tsx
│  ├─ PatternMirror.tsx
│  ├─ StoryRhythm.tsx
│  ├─ NumberJumper.tsx
│  ├─ ColorSequence.tsx
│  ├─ TargetChase.tsx
│  └─ WordEcho.tsx
│
├─ Hooks
│  ├─ useAuth (session management)
│  ├─ useLanguage (i18n)
│  ├─ useConsent (privacy controls)
│  └─ useOfflineSync (PWA sync queue)
│
└─ Services
   ├─ API (REST calls)
   ├─ ML (feature extraction)
   └─ Storage (IndexedDB offline)
```

---

## Accessibility Features

✅ **Keyboard Navigation:**
- Tab between interactive elements
- Enter/Space to activate buttons
- Arrow keys for game controls

✅ **Screen Reader Support:**
- ARIA labels on all interactive elements
- Live regions for game status updates
- Semantic HTML structure

✅ **Visual:**
- 48px touch targets (exceeds 44px requirement)
- Color + shape coding (not color alone)
- High contrast (WCAG AAA compliant)
- Readable fonts (16px minimum)

✅ **Language:**
- Full UI in Amharic, Oromo, Tigrinya
- Audio instructions in selected language
- Ethiopic script rendering

---

## Performance

- **Bundle Size:** <4MB gzipped
- **Game Load:** <5s (after caching)
- **Frame Rate:** ≥30 FPS on 2GB RAM devices
- **Input Latency:** <100ms (p95)
- **Offline:** Full PWA support (caching + sync)

---

## Current Running Instance

**URL:** http://localhost:5173/  
**Status:** ✅ Development server running  
**Vite Version:** 6.0.11  

To view:
1. Open http://localhost:5173/ in browser
2. Login with phone number
3. Select child or create new profile
4. Click "Start Assessment"
5. Play through 7 games (~20 minutes)
6. View AI-generated report in Amharic

