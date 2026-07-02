Table of Contents

# EARLYMIND

## Software Requirements Specification (SRS)

### AI-Powered Learning Disability Early Detection System

**Document Version:** 1.0 (Condensed) | **Date:** June 2026 | **Prepared By:** EarlyMind Development Team | **Client:** Ethiopian Artificial Intelligence Institute (EAII) | **Status:** Approved for Development

# 1\. Introduction

## 1.1 Purpose

This SRS is the single source of truth for developing, testing, deploying, and maintaining the **EarlyMind AI-Powered Learning Disability Early Detection System**. It serves as the development blueprint, testing basis, project-management reference, stakeholder communication tool, and compliance record for data privacy, child protection, and ethical AI.

It covers: the web-based gamified assessment app, backend API and data services, ML training/inference pipeline, report generation and explainability, federated learning infrastructure, and administrative dashboards.

## 1.2 Document Conventions

**Priority levels (MoSCoW):**

| Priority | Label            | Meaning                                                      |
| -------- | ---------------- | ------------------------------------------------------------ |
| P0       | Must Have        | Critical; system cannot function or ship without it          |
| P1       | Should Have      | Important; included in Phase 1 if time permits, else Phase 2 |
| P2       | Could Have       | Desirable; Phase 2+                                          |
| P3       | Won't Have (now) | Out of scope; future roadmap only                            |

**Requirement numbering:** \[Component\]-\[Category\]-\[Number\], e.g. AUTH-FR-001 (Authentication, Functional Requirement #1).

- **Components:** AUTH, GAME, DATA, ML, REPORT, DASH, FED, PWA, API, SEC
- **Categories:** FR (Functional), NFR (Non-Functional), DR (Data), BR (Business Rule), CR (Constraint)

**Requirement template:** ID, Priority, Title, Description, Acceptance Criteria, Dependencies, Verification Method (Rationale and Business Rules included where they clarify intent).

## 1.3 Intended Audience

| Audience                  | Focus Sections                      | Usage                                             |
| ------------------------- | ----------------------------------- | ------------------------------------------------- |
| Development Team          | 3, 4, 5, 7, 9                       | Implementation specs and acceptance criteria      |
| QA Team                   | 3, 6, 10                            | Test case design and validation                   |
| ML Engineers              | 4, 6.1, 7, 8                        | Model architecture, training, feature engineering |
| UI/UX Designers           | 3.1, 3.5, 3.6, 4, 5.1, 6.5          | Interface design and accessibility                |
| Project Managers          | 1.4, 2, 3, priority tags throughout | Planning, estimation, tracking                    |
| EAII Stakeholders         | 1, 2, 3 (high-level), 6             | Scope alignment, compliance                       |
| Auditors/Ethics Reviewers | 2.5.6, 2.7, 6.2, 6.3, 7.4           | Compliance and ethical AI review                  |

## 1.4 Project Scope

### 1.4.1 In Scope

**Core Platform** - Responsive PWA with 7 validated cognitive games, playable on phones/tablets/desktop - Native Amharic, Oromo, and Tigrinya support (UI, audio, culturally adapted visuals) - Offline-capable gameplay with local caching

**Behavioral Data Capture** - Millisecond-precision event logging; 200+ micro-behavioral features - Client-side processing/anonymization; transmission only with consent; real-time age normalization

**ML Detection Engine** - Multi-label classification for 6 conditions: dyslexia, dyscalculia, ADHD-Inattentive, ADHD-Hyperactive/Impulsive, working memory deficit, processing speed deficit - LSTM + Transformer hybrid architecture, age-conditional normalization (4-10 years)

**Reporting, Dashboards, Federated Learning** - plain-language Amharic parent reports, teacher accommodation guides, referral recommendations, school/regional aggregate analytics, privacy-preserving federated model improvement.

**Assessment & Research Tools** - inter-rater reliability measurement, export to ML training formats.

**Non-Software Deliverables** - Documentation: this SRS, System Architecture Document, API docs (OpenAPI), User Manual, Admin Guide, Deployment Guide, Model Training Guide - Research outputs: annotated dataset (150-300 children), trained model weights, research paper draft, open-source component libraries - Pilot: deployment in 3 Addis Ababa schools, 150-300 children aged 4-10, teacher training, feedback iteration

### 1.4.2 Out of Scope

- **Clinical diagnosis** - screening only; no formal diagnosis or treatment beyond classroom accommodations
- **Native mobile apps** - web-only (installable as PWA); native apps are future roadmap
- **Languages beyond Amharic, Oromo, Tigrinya** - English, Somali, Afar, etc. are future features
- **School management system integration** - CSV/Excel export only; API integration is post-launch
- **Hardware procurement** - pilot schools supply their own devices
- **Payment processing** - pilot is free of charge
- **Telehealth/direct specialist consultation** - reports include IERC contact info only, no booking
- **Long-term longitudinal tracking** - re-screening supported; multi-year tracking dashboard is future work
- **Game content authoring tools** - content is fixed by the research team
- **Real-time collaboration** - no multi-user sessions or live messaging; reports are asynchronous
- **International deployment** - Ethiopia only in this phase
- **Ages outside 4-10** - games and norms are not designed for other ages
- **Large-scale clinical validation (1000+ participants)** - pilot is limited to 150-300 children
- **Genetic/biomedical data collection** - behavioral data only

### 1.4.3 Scope Boundaries (Selected Cases)

| Scenario                                    | In Scope? | Notes                            |
| ------------------------------------------- | --------- | -------------------------------- |
| Parent screens own child at home            | Yes       | Core use case                    |
| Teacher screens a class of students         | Yes       | Core use case                    |
| School admin views aggregate stats          | Yes       | Dashboard feature                |
| EAII researcher exports anonymized data     | Yes       | Admin export function            |
| SMS notification on report ready            | No        | Email/in-app only                |
| Auto-translation of report to English       | No        | Amharic only in Phase 1          |
| Integration with MoE EMIS database          | No        | Requires future MoE partnership  |
| Booking a psychologist through the platform | No        | Contact info only                |
| Model trained on non-Ethiopian data         | No        | Ethiopian data only              |
| Adaptive difficulty                         | Yes       | Included                         |
| Parent deletes all child data               | Yes       | GDPR right to erasure            |
| Teacher sees raw behavioral data            | No        | Privacy protection; summary only |

### 1.4.4 Success Criteria

**Technical:** All P0 requirements implemented and tested; ML sensitivity ≥80% per condition on held-out test set; runs on 2GB-RAM devices; 95% of actions complete in a few seconds; zero critical security vulnerabilities in production.

**Research:** Behavioral data from 150-300 Ethiopian children aged 4-10; inter-annotator Cohen's Kappa ≥0.75; research paper submitted; dataset and model weights published.

**User Acceptance:** ≥80% of parents rate screening "easy"/"very easy"; ≥80% of teachers rate the accommodation guide useful; session completion rate >85%; SUS score ≥68.

**Operational:** ≥99% uptime during pilot; zero data breaches; all child data encrypted at rest/in transit; deployment within 8-week timeline.

**Institutional:** Interest letters from ≥3 stakeholders (MoE, NGO, or private school network); EAII approval for public beta; independent ethics board sign-off.

## 1.5 Definitions, Acronyms, and Abbreviations

### 1.5.1 Key Definitions

| Term                           | Definition                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screening**                  | A brief process to flag at-risk individuals for further evaluation - not a diagnosis.                                                                                     |
| **Learning Disability (LD)**   | A neurodevelopmental condition affecting how the brain receives, processes, stores, or responds to information despite normal intelligence (e.g., dyslexia, dyscalculia). |
| **Dyslexia**                   | Difficulty with accurate/fluent word recognition, spelling, and decoding, typically from a phonological-processing deficit.                                               |
| **Dyscalculia**                | Difficulty acquiring arithmetic skills, number sense, and mathematical reasoning.                                                                                         |
| **ADHD**                       | Neurodevelopmental disorder with persistent inattention and/or hyperactivity-impulsivity; Inattentive and Hyperactive/Impulsive subtypes.                                 |
| **Working Memory Deficit**     | Impaired ability to temporarily hold and manipulate information for complex tasks.                                                                                        |
| **Processing Speed Deficit**   | Slower-than-typical pace of taking in and responding to information, independent of intelligence.                                                                         |
| **Ground Truth**               | Verified condition status (typically clinical) used to train/validate the ML model.                                                                                       |
| **Session**                    | One complete playthrough of all seven games (~15-20 minutes).                                                                                                             |
| **Micro-behavior**             | Millisecond-precision interaction data (hesitation, swipe velocity, error correction, etc.).                                                                              |
| **Feature Vector**             | Numerical array of a child's behavioral characteristics, used as ML input.                                                                                                |
| **Multi-label Classification** | ML task where one session can belong to multiple classes simultaneously.                                                                                                  |
| **Federated Learning**         | Distributed training where only model updates, not raw data, leave the device.                                                                                            |
| **Explainability (XAI)**       | An AI system's ability to justify predictions in human-understandable terms.                                                                                              |
| **SHAP**                       | Game-theoretic method for explaining individual ML predictions via feature contribution.                                                                                  |
| **PWA**                        | Web app with offline functionality and home-screen installation.                                                                                                          |
| **IERC**                       | Government-supported Ethiopian centers for children with special educational needs.                                                                                       |
| **Normative Data**             | Statistics on typical age-group performance, used to flag atypical results.                                                                                               |
| **Sensitivity / Specificity**  | True-positive rate / true-negative rate of the screening.                                                                                                                 |
| **Inter-rater Reliability**    | Degree of agreement between annotators on ground-truth labels.                                                                                                            |

### 1.5.2 Acronyms

ADHD, AI, API, AWS, COPPA, CORS, CRUD, CSS, CSV, DB, DevOps, DL, EAII (Ethiopian AI Institute), EC2, EMIS, ETB, GDPR, GUI, HTML, HTTP/HTTPS, IERC, JSON, JWT, LD, LSTM, MFA, ML, MoE, MVP, NFR, NGO, NLP, OTP, PDF, PWA, RBAC, REST, S3, SDK, SHAP, SMS, SQL, SRS, SUS, UAT, UI, UX, UUID, WCAG, XAI - standard meanings as used throughout this document.

### 1.5.3 Ethiopian Language Terms (UI)

| English    | Amharic (Fidel) | Transliteration       |
| ---------- | --------------- | --------------------- |
| Welcome    | እንኳን ደህና መጣህ/ሽ  | Enkuan dehna metah/sh |
| Child      | ልጅ              | Lij                   |
| Parent     | ወላጅ             | Walaj                 |
| Teacher    | መምህር            | Memhir                |
| Game       | ጨዋታ             | Chewata               |
| Start      | ጀምር             | Jemir                 |
| Next       | ቀጣይ             | Qetay                 |
| Assessment | ግምገማ            | Gimgema               |
| Learning   | ትምህርት           | Timhirt               |
| Difficulty | ችግር             | Chigr                 |

## 1.6 References

**Standards:** IEEE 830-1998, IEEE/ISO/IEC 29148-2018, ISO/IEC 25010:2011, WCAG 2.1.

**Privacy/Compliance:** GDPR (EU 2016/679), COPPA, UNESCO Recommendation on the Ethics of AI (2021), UN CRPD Article 24.

**Scientific/Clinical:** Baddeley (2000) on the episodic buffer; Dehaene (1992) Triple Code Model; Tallal (2004) on temporal auditory processing; Barkley (1997) on executive function and ADHD; PLOS ONE (2020) gamified dyslexia screening (N=3,600+); MDPI Information (2025) on gamified dyscalculia detection.

**Technology:** React 18.x, Node.js 18.x LTS, PostgreSQL 14.x, TensorFlow.js, Flower federated learning framework, SHAP library documentation.

**Ethiopian Context:** World Bank/UNESCO (2024) Ethiopia Education Country Brief; UNICEF (2021) global disability estimates; Ethiopia ESDP VI and GEQIP-E program documentation.

## 1.7 Document Overview

Sections 1-2 give context, scope, and system description. Sections 3-4 detail functional requirements and game specifications. Sections 5-6 cover interfaces and non-functional requirements. Sections 7-8 define data architecture and ML specs. Section 9 covers the API. Sections 10-11 cover testing, deployment, and maintenance. Section 12 holds appendices.

# 2\. Overall Description

## 2.1 Product Perspective

EarlyMind is a new, independent system for the Ethiopian educational and healthcare ecosystem - not a replacement for or integration with any existing system, though designed for future integration.

**System context:** Parents (home use), teachers (classroom), and schools (admin) all interact with the EarlyMind web platform, which in turn can produce referrals toward the Ministry of Education, IERCs (referral centers), and clinical specialists (diagnosis).

**Position in workflow:** EarlyMind is the first step in the LD identification pipeline. Today, a struggling child often goes unrecognized by teachers and unaware/unacknowledged by parents until they fail or drop out. With EarlyMind, a child is screened around age 5 in a 20-minute session, producing a report to parents and teachers with classroom accommodations and, if warranted, a referral toward clinical diagnosis.

**Hardware platform:** Hardware-agnostic. Minimum: any smartphone/tablet/desktop with ≥2GB RAM, ≥4.7" screen, touch preferred but not required. Supported OS: Android 8.0+, iOS 12+, Windows 10+, macOS 10.13+, modern Linux. Requires a modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+) with JavaScript enabled; internet needed only for initial load.

**Software platform:** Client-server web app with PWA capabilities. Frontend: React SPA. Backend: Node.js REST API. Database: PostgreSQL. ML: Python microservice (TensorFlow/PyTorch). Hosting: AWS. Offline support via Service Worker caching.

**Major components (5-layer architecture):** 1. Gamified Assessment Engine - 7 games x 3 languages 2. Micro-Behavior Feature Extraction - 200+ signals per session 3. Multi-Label Deep Learning Classifier - LSTM + Transformer -> 6 conditions 4. Explainability & Report Generation - SHAP -> Amharic reports 5. Federated Learning & Privacy Architecture - on-device training, no raw data leaves the browser

## 2.2 Product Functions

| Function                | Description                                            | Primary User       |
| ----------------------- | ------------------------------------------------------ | ------------------ |
| Child Screening         | Administer 7 gamified assessments in 15-20 min         | Parent, Teacher    |
| Behavioral Analysis     | Extract 200+ signals, normalize by age                 | System             |
| LD Detection            | Classify risk for 6 conditions via ML                  | System             |
| Report Generation       | Plain-language Amharic reports and teacher guides      | System             |
| Referral Recommendation | Suggest nearest IERC/specialist when indicated         | System             |
| Aggregate Analytics     | School-wide/regional detection pattern visualization   | School Admin, EAII |
| Federated Learning      | Improve the global model without centralizing raw data | System             |
| User Management         | Create/manage parent, teacher, child accounts          | All users          |
| Data Export             | Export anonymized research datasets                    | EAII Researcher    |

**Function-to-layer mapping:** Game delivery (Layer 1, React) -> event capture and feature engineering (Layer 2, JS/TensorFlow.js) -> ML classification (Layer 3, Python) -> SHAP explanation and report text via LangChain + Gemini (Layer 4) -> on-device training via TensorFlow.js and global aggregation via Flower (Layer 5).

## 2.3 User Classes and Characteristics

EarlyMind serves four user classes with distinct needs and permissions.

**Parents/Caregivers** - Low-to-medium technical sophistication; primary language Amharic/Oromo/Tigrinya; variable literacy; use the system 1-4 times/year per child. Can create their own account, create child profiles, administer assessments, view their children's reports, manage consent, and delete their data. Need a simple interface with minimal reading, audio instructions, jargon-free explanations, actionable next steps, and privacy reassurance.

**Teachers** - Low-to-medium technical sophistication; responsible for 30-60 students; use the system frequently during screening periods. Can create student profiles for their class, administer assessments, view class-level aggregates and individual accommodation guides - but **cannot** view raw behavioral data or delete student data. Need batch profile creation, an efficient screening workflow, classroom-appropriate (non-clinical) recommendations, and a simple dashboard.

**School Administrators** - Medium technical sophistication; oversee the whole school; moderate frequency of use. Can view aggregate school analytics, monitor teacher screening completion, manage teacher accounts, and export anonymized data - but **cannot** view individually identifiable student data without parent consent. Need completion-rate dashboards, comparison context, and MoE-compatible export formats.

**EAII System Administrators & Researchers** - High technical sophistication (developers, data scientists, ML engineers); daily use. Have full system access (user management, model training/deployment, configuration, audit logs, anonymized export) but **cannot** access identifiable child data without explicit consent and audit logging. Need system health monitoring, model performance metrics, retraining tools, and audit trails.

**Comparison summary:**

| Attribute         | Parents                | Teachers               | School Admins    | EAII Staff               |
| ----------------- | ---------------------- | ---------------------- | ---------------- | ------------------------ |
| Technical Skill   | Low-Medium             | Low-Medium             | Medium           | High                     |
| Primary Language  | Amharic/Oromo/Tigrinya | Amharic                | Amharic/English  | English                  |
| Frequency of Use  | Occasional             | Frequent (seasonal)    | Moderate         | Daily                    |
| Mobile vs Desktop | 90% mobile             | 60/40                  | 70% desktop      | 100% desktop             |
| Data Access       | Own children only      | Own students (summary) | School aggregate | System-wide (anonymized) |

**Accessibility across all classes:** high-contrast/scalable-font visual support, audio instructions, touchscreen/mouse/keyboard motor support, simple/consistent cognitive design, and full trilingual linguistic support (WCAG 2.1 AA).

## 2.4 Operating Environment

### 2.4.1 Client-Side Environment

**Minimum device:** 1.5GHz dual-core CPU, 2GB RAM, 50MB free storage, 4.7" screen (320x568 min), single-touch. **Recommended:** 2.0GHz quad-core, 4GB RAM, 200MB storage, 7"+ screen, multi-touch.

**Browsers:** Chrome 90+ (preferred, best TensorFlow.js performance), Firefox 88+, Safari 14+ (iOS), Edge 90+ (Windows). Requires JavaScript, LocalStorage (>=5MB), IndexedDB, Service Workers, Web Audio API, Canvas API. OS: Android 8.0+, iOS 12+, Windows 10+, macOS 10.13+, Ubuntu 18.04+.

### 2.4.2 Network Environment

Ethiopia's connectivity varies: urban areas typically have 3G/4G and school/cafe WiFi (2-5 Mbps, 100-300ms latency); rural areas often have intermittent 2G/3G with limited WiFi (0.5-2 Mbps, 300-1000ms latency, frequent drops).

**System response:** PWA architecture for a ~5MB initial WiFi download then full offline functionality; games chunk-loaded individually (~700KB each); offline-first sessions; background sync with retry/exponential backoff for uploads; Brotli/gzip compression on all assets.

**Bandwidth (approximate):** initial load ~5MB (one-time), per-game download ~700KB, per-language audio ~2MB, result upload ~50KB, PDF report ~300KB, dashboard load ~200KB.

### 2.4.3 Server-Side Environment

**Hosting:** AWS. CloudFront (CDN) serves static assets from S3; Route 53 (DNS) and ACM (SSL/TLS) front an Application Load Balancer distributing to auto-scaling Node.js backend instances on EC2; backend connects to a Multi-AZ Aurora PostgreSQL (RDS) database; a separate EC2 ML service (Python/TensorFlow) reads/writes model artifacts in S3.

**Compute:** Web servers - t3.medium (2 vCPU/4GB), 2 instances auto-scaling to 4, Amazon Linux 2. ML inference - t3.large or c5.xlarge (CPU-optimized, no GPU required), 1 instance scaling to 2, Ubuntu 20.04.

**Database:** RDS Aurora PostgreSQL, db.t3.medium, 100GB auto-scaling SSD, Multi-AZ, daily automated snapshots (7-day retention).

**Storage (S3 buckets):** earlymind-static (public assets), earlymind-reports (private, signed URLs), earlymind-models (private), earlymind-backups (encrypted, private).

**CDN:** CloudFront in front of earlymind-static; 7-day TTL for game assets, 1-hour TTL for HTML; automatic Brotli/gzip.

### 2.4.4 Security Environment

- HTTPS-only (TLS 1.2+), HSTS, CSP headers, ACM auto-renewed certificates
- Backend in private VPC subnets; least-privilege security groups (web: 443 from ALB only; DB: 5432 from web servers only; ML: 8000 from web servers only)
- WAF at the CloudFront edge (SQLi/XSS protection, 100 req/min/IP rate limiting)
- Encryption at rest: RDS AES-256, S3 SSE-S3, encrypted EBS volumes; encryption in transit: TLS 1.2+; key management via AWS KMS

### 2.4.5 Third-Party Dependencies

| Service                    | Purpose                        | Criticality | Fallback                       |
| -------------------------- | ------------------------------ | ----------- | ------------------------------ |
| Google Gemini API          | Report text generation         | High        | Pre-generated templates        |
| Flower Coordination Server | Federated learning aggregation | Medium      | Operate without FL temporarily |
| AWS Services               | Hosting, storage, compute      | Critical    | None                           |
| Sentry                     | Error tracking                 | Low         | System continues without it    |

Core open-source stack: React 18.x, Node.js 18.x LTS, Express 4.x, PostgreSQL 14.x, TensorFlow.js 4.x, SHAP, Flower, Chart.js, jsPDF (full list in package.json).

### 2.4.6 Regulatory Environment

GDPR and COPPA compliance required (children's data); alignment with Ethiopia's emerging national data protection framework; Ministry of Education approval for school deployment; IRB approval for research data collection; parental consent for all children; WCAG 2.1 AA accessibility.

## 2.5 Design and Implementation Constraints

### 2.5.1 Regulatory and Legal

| ID          | Constraint                                                                                 | Verification              |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| CON-REG-001 | Explicit parental consent (multi-language form) before any assessment                      | Ethics review; parent UAT |
| CON-REG-002 | GDPR right to erasure - full deletion across all storage systems                           | Compliance audit          |
| CON-REG-003 | No under-18 data used for research without IRB approval                                    | IRB review; code audit    |
| CON-REG-004 | Reports must state "This is a screening, not a diagnosis"                                  | Legal/template review     |
| CON-REG-005 | COPPA compliance - no persistent identifiers, no behavioral advertising, parental controls | Compliance checklist      |

### 2.5.2 Technical

| ID           | Constraint                                           | Mitigation                           |
| ------------ | ---------------------------------------------------- | ------------------------------------ |
| CON-TECH-001 | Must run on 2GB-RAM devices                          | Memory-efficient code, lazy loading  |
| CON-TECH-002 | Core gameplay must work offline after initial load   | PWA, IndexedDB, service workers      |
| CON-TECH-003 | Cannot rely on email for auth                        | SMS/in-app OTP                       |
| CON-TECH-004 | Must support Ethiopic script (Fidel)                 | Unicode fonts, native-speaker review |
| CON-TECH-005 | Browser-based only in Phase 1                        | Responsive PWA                       |
| CON-TECH-006 | No required software installs                        | Web-only, no plugins                 |
| CON-TECH-007 | Max initial load: 5MB compressed / 15MB uncompressed | Asset optimization, code splitting   |

### 2.5.3 Data Privacy and Security

| ID           | Constraint                                                            | Implementation                                        |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------- |
| CON-PRIV-001 | Raw behavioral data never leaves the client unless the parent opts in | Client-side feature extraction; only vectors uploaded |
| CON-PRIV-002 | Child data encrypted at rest (AES-256)                                | DB and S3 encryption                                  |
| CON-PRIV-003 | Child data encrypted in transit (TLS 1.2+)                            | HTTPS only                                            |
| CON-PRIV-004 | Teachers cannot see raw performance data                              | RBAC + access auditing                                |
| CON-PRIV-005 | Admins need consent + audit trail for identifiable data               | DB-level access controls                              |
| CON-PRIV-006 | Federated learning must use differential privacy                      | Flower + DP; privacy budget monitoring                |

### 2.5.4 Resource and Timeline

- CON-RES-001: total development timeline is 8 weeks - requires aggressive scope management and phased delivery
- CON-RES-002: total budget is \$40,000 USD - use open-source tools, limit paid API usage, avoid expensive commercial licenses
- CON-RES-003: core team size is 4-6 people - requires modular architecture and clear role separation
- CON-RES-004: pilot data collection is capped at 300 children - may limit ML model accuracy; needs careful sampling
- CON-RES-005: cloud infrastructure budget is \$4,000 for 12 months - use cost-effective AWS instance sizing

### 2.5.5 Linguistic and Cultural

- CON-CULT-001: avoid Western cultural references unfamiliar to Ethiopian children (e.g., snow, Santa Claus)
- CON-CULT-002: game visuals must reflect Ethiopian context (skin tones, clothing, environments)
- CON-CULT-003: Amharic audio recorded by native speakers with clear pronunciation
- CON-CULT-004: medical/educational terms translated to parent-friendly Amharic
- CON-CULT-005: avoid stigmatizing language ("disability," "disorder") in parent-facing UI

### 2.5.6 Ethical

- CON-ETH-001: no diagnostic claims - screening only
- CON-ETH-002: no denial of educational access based on screening results
- CON-ETH-003: minimize false positives to avoid unnecessary parent anxiety
- CON-ETH-004: always pair risk scores with actionable next steps, not just numbers
- CON-ETH-005: audit the ML model for bias across gender, socioeconomic status, and region
- CON-ETH-006: pilot access is free for schools and parents; no payment required

### 2.5.7 Scientific

- CON-SCI-001: games must be grounded in established cognitive-assessment frameworks
- CON-SCI-002: ground-truth labels from validated checklists or clinical assessment
- CON-SCI-003: minimum sample size 150 children across 6 conditions
- CON-SCI-004: inter-rater reliability (Cohen's Kappa) >=0.75
- CON-SCI-005: model reports calibrated confidence/uncertainty, not binary predictions

### 2.5.8 Performance

- CON-PERF-001: frame rate >=30 FPS on minimum-spec devices
- CON-PERF-002: API response <2s (95th percentile)
- CON-PERF-003: ML inference <5s for full session analysis
- CON-PERF-004: report generation <10s
- CON-PERF-005: system uptime >=99% during the pilot period

### 2.5.9 Accessibility

- CON-ACC-001: meet WCAG 2.1 Level AA
- CON-ACC-002: minimum 44x44px touch target size
- CON-ACC-003: color must never be the sole means of conveying information
- CON-ACC-004: all audio must have visual equivalents
- CON-ACC-005: UI must be fully navigable by keyboard, not just touch/mouse

## 2.6 User Documentation

| Document                          | Audience      | Language(s)              | Format                |
| --------------------------------- | ------------- | ------------------------ | --------------------- |
| Parent Quick Start Guide          | Parents       | Amharic, Oromo, Tigrinya | PDF + in-app tutorial |
| Teacher User Manual               | Teachers      | Amharic, English         | PDF + 5-min video     |
| School Administrator Guide        | School Admins | Amharic, English         | PDF                   |
| Understanding Your Child's Report | Parents       | Amharic                  | PDF + infographic     |
| Classroom Accommodations Handbook | Teachers      | Amharic, English         | PDF                   |

The Parent Quick Start Guide covers: what EarlyMind is, account creation, running the assessment, understanding the report, next-step/referral guidance, FAQs, and privacy. The Teacher User Manual additionally covers class roster setup, batch screening, interpreting reports, classroom accommodations, and troubleshooting. Technical documentation (System Architecture Document, API docs, deployment/model-training guides) is maintained in Markdown alongside the codebase and updated with major releases.

## 2.7 Assumptions and Dependencies

### 2.7.1 Assumptions

**User:** ASM-USR-001 >=60% of target parents have or can borrow a smartphone (else: devices needed, higher pilot cost). ASM-USR-002 teachers will allocate 3-4 class hours to screen 30 students (else: redesign for shorter/after-school sessions). ASM-USR-003 parents will trust AI-based assessment if results are explained clearly (else: need credibility-building/endorsements). ASM-USR-004 target users can follow spoken Amharic instructions even if semi-literate (else: need a visual-only mode). ASM-USR-005 school administrators will grant pilot permission (else: need top-down MoE engagement).

**Technical:** ASM-TECH-001 pilot schools have enough WiFi/data for the initial 5MB download (else: pre-load via USB). ASM-TECH-002 modern browsers (Chrome 90+, Firefox 88+) are available on target devices (else: support older browsers, more dev time). ASM-TECH-003 AWS availability/pricing stays stable for the project period (else: may need to migrate host). ASM-TECH-004 Gemini API free tier covers ~300 pilot reports (else: budget for paid tier or an alternative LLM). ASM-TECH-005 TensorFlow.js inference completes in <5s on 2GB-RAM devices (else: simplify the model or move inference server-side).

**Data:** ASM-DATA-001 150-300 labeled samples suffice for >=80% sensitivity (else: expand the pilot or use transfer learning). ASM-DATA-002 Cohen's Kappa >=0.75 is achievable with teacher annotations (else: need clinical ground-truth labels). ASM-DATA-003 Ethiopian children's performance distributions are close enough to existing frameworks for current game designs to differentiate LD (else: redesign games/baselines). ASM-DATA-004 parents will consent at >=70% (else: revise the consent process or increase community engagement).

**Institutional:** ASM-INST-001 EAII provides timely review/approval at milestones (else: timeline risk beyond 8 weeks). ASM-INST-002 ethics approval granted within 2 weeks of submission (else: data collection delayed; need contingency timeline). ASM-INST-003 MoE introduces no conflicting policy during the pilot (else: may need to pause/redesign). ASM-INST-004 partner schools stay engaged through the 8-week pilot (else: need backup schools identified in advance).

### 2.7.2 Dependencies

**External services:** DEP-SVC-001 AWS hosting/storage/compute (critical, no fallback - system down if unavailable). DEP-SVC-002 Google Gemini API for report text (high - falls back to template-based reports). DEP-SVC-003 Flower coordination server for federated learning (medium - can operate without FL short-term). DEP-SVC-004 Sentry error monitoring (low - system continues without it). DEP-SVC-005 Google Analytics, optional (low - not critical to core function).

**Core software (all MIT/Apache 2.0, commercial-use compatible):** DEP-SW-001 React 18.x (critical). DEP-SW-002 Node.js 18.x LTS (critical). DEP-SW-003 PostgreSQL 14.x (critical). DEP-SW-004 TensorFlow.js 4.x (critical). DEP-SW-005 SHAP, latest (high). DEP-SW-006 Flower 1.x (medium). DEP-SW-007 Chart.js 4.x (medium). DEP-SW-008 jsPDF 2.x (medium).

**Institutional:** DEP-INST-001 ethics approval from the EAII Ethics Board/university IRB, Weeks 1-2 (critical). DEP-INST-002 pilot-school access via MoE/principals, Weeks 2-3 (critical). DEP-INST-003 validated Amharic LD screening checklists from special-education specialists, Week 1. DEP-INST-004 Amharic linguistic review of all UI/audio, Weeks 3-4. DEP-INST-005 cultural-consultant review of game content/visuals, Week 3.

**Human resources (8 weeks):** DEP-HR-001 frontend developer, React/PWA, full-time. DEP-HR-002 backend developer, Node.js/PostgreSQL, full-time. DEP-HR-003 ML engineer, Python/TensorFlow/SHAP, full-time. DEP-HR-004 UI/UX designer, part-time Weeks 1-4. DEP-HR-005 clinical consultant, part-time Weeks 1 and 5-6. DEP-HR-006 Amharic voice actor, 2 days in Week 3. DEP-HR-007 data annotators, part-time Weeks 4-5.

**Data:** DEP-DATA-001 150-300 consented pilot children from partner schools (critical). DEP-DATA-002 ground-truth labels from teacher/clinician checklists (critical). DEP-DATA-003 normative performance baselines from pilot data collection (high). DEP-DATA-004 Gemini API access for Amharic report generation (medium).

**Research:** DEP-RES-001 academic cognitive-assessment frameworks (phonological processing, working memory, attention models). DEP-RES-002 Unicode Ethiopic font rendering. DEP-RES-003 WHO/UNESCO/local LD-prevalence estimates as detection-rate baselines.

## **Highest-risk dependencies:** pilot school access (DEP-INST-002) and ethics approval (DEP-INST-001) - low probability of failure but critical impact; mitigated by engaging 5 schools (only 3 needed) and filing the ethics application early. Minimum 150 participants (DEP-DATA-001) - medium probability, critical impact; mitigated by over-recruiting to 250 with 50% attrition planning. Ground-truth label quality (DEP-DATA-002) - medium probability, high impact; mitigated by multiple annotators with inter-rater reliability tracking. AWS availability (DEP-SVC-001) - very low probability, critical impact; mitigated by AWS's 99.9% SLA and status-page monitoring. ML engineer availability (DEP-HR-003) - low probability, critical impact; mitigated by hiring early with a backup candidate identified

# 3\. System Features and Requirements

This section specifies functional requirements by feature area, following the template in Section 1.2.

## 3.1 User Management and Authentication

**Priority:** P0 | **Affects:** All user classes | **Dependencies:** None (foundational)

Enables parents, teachers, school admins, and EAII staff to register, authenticate, manage profiles, and access role-appropriate functionality.

#### AUTH-FR-001: User Registration (P0)

The system shall allow registration using only a phone number (no email required), since many Ethiopian parents/teachers lack email. During registration the user selects role (Parent/Teacher/School Administrator) and language (Amharic/Oromo/Tigrinya).

**Acceptance Criteria:** Form shown in selected language; phone entered as +251-XXX-XXX-XXX and format-validated; role and language selected; user sets a 4-digit PIN (no complex password rules); system sends a 6-digit SMS OTP, valid 5 minutes, max 3 resend requests/hour; account created and user logged in on successful verification.

**Business Rules:** phone numbers unique per account; minimum self-attested age 18 for parent role; Teacher/School Admin roles require school affiliation at registration.

#### AUTH-FR-002: OTP-Based Login (P0)

Returning users log in with phone number plus either their 4-digit PIN or a freshly requested OTP.

**Acceptance Criteria:** choice of "Login with PIN" or "Send OTP"; PIN lockout for 15 minutes after 3 failed attempts; OTP valid 5 minutes; successful login redirects to the role-appropriate dashboard; session expires after 7 days of inactivity.

**Business Rules:** max 3 OTP requests/hour/phone; session tokens in secure, httpOnly, SameSite cookies. **Dependencies:** AUTH-FR-001.

#### AUTH-FR-003: Profile Management (P0)

Authenticated users can view/edit name, phone number (display-only; changes require re-verification), language preference, and PIN. Changing language updates the whole UI immediately. **Dependencies:** AUTH-FR-001, AUTH-FR-002.

#### AUTH-FR-004: Role-Based Access Control (P0)

Feature and data access is restricted by role, enforced at both UI and API layers (unauthorized access returns HTTP 403).

- **Parents:** create child profiles; administer/view their children's assessments and reports; manage consent; delete their own data
- **Teachers:** create/screen students in their class; view class-level summaries and aggregates (not raw data); cannot delete student data
- **School Admins:** view school aggregate stats; manage teacher accounts; export anonymized data; cannot view identifiable student data without parent consent
- **EAII Admins:** full system access, cannot view identifiable child data without consent and audit logging

**Business Rules:** role fixed at registration, changeable only by EAII admin; one role per account; all endpoints implement RBAC middleware. **Dependencies:** AUTH-FR-001.

#### AUTH-FR-005: Account Deletion / GDPR Right to Erasure (P0)

Parents can permanently delete their account and all associated child data. Requires re-authentication (PIN/OTP) and an explicit "I understand this is permanent" confirmation. On confirmation the system deletes the user account, all child profiles, all session and report data, and anonymizes audit-log identifiers; deletion is immediate and irreversible, with any data shared with a school/teacher also deleted or anonymized.

**Business Rules:** only parents can initiate deletion; teachers/schools must request it via the parent; deletion is logged (anonymized) in the audit trail; federated-learning updates already derived from deleted data cannot be un-trained, but future updates exclude it. **Dependencies:** AUTH-FR-001.

### Non-Functional Requirements - User Management

- **AUTH-NFR-001 (P0) Security:** PINs hashed with bcrypt (cost >=12); session tokens >=128-bit entropy in httpOnly/secure/SameSite cookies; max 7-day sessions; failed logins logged. _Verification: security audit, penetration testing._
- **AUTH-NFR-002 (P1) Performance:** PIN login <1s (p95); OTP delivery <30s; profile update <2s. _Verification: load testing, 100 concurrent users._
- **AUTH-NFR-003 (P0) Availability:** >=99.5% uptime; graceful degradation with retry if OTP SMS fails. _Verification: uptime monitoring, failure injection._

## 3.2 Gamified Assessment Engine

**Priority:** P0 | **Dependencies:** AUTH

Delivers seven cognitive games to children aged 4-10, capturing behavioral responses at millisecond precision. Section 4 gives per-game detail; this section covers the engine.

### Session Lifecycle & Interaction

#### GAME-FR-001: Assessment Session Initialization (P0)

A parent or teacher starts a new session from the child's profile page. The pre-assessment screen shows the child's name/age, language selection, estimated duration (15-20 min), adult instructions, and (for parents) a privacy/consent confirmation. On "Begin," the system creates a session record (UUID, child ID, start timestamp, language, device info), initializes the fixed 7-game sequence, and mirrors session state to LocalStorage for refresh recovery.

**Business Rules:** a child may have only one active (incomplete) session at a time; an incomplete prior session prompts the user to resume or restart; the selected language applies to all 7 games. **Dependencies:** child profile must exist.

#### GAME-FR-002: Game Sequencing and Flow (P0)

The seven games are presented in a fixed, scientifically determined order: Letter Rain, Pattern Mirror, Story Rhythm, Number Jumper, Color Sequence, Target Chase, Word Echo. A 3-second encouraging transition screen appears between games; a "Game X of 7" progress bar is always visible; the child cannot skip or go backward; each game opens with brief audio instructions in the selected language; a "Pause" button (GAME-FR-003) is always visible.

**Business Rules:** game order is fixed and not customizable; resuming after a pause returns to the same game, not the start; total expected duration is 15-20 minutes. **Dependencies:** GAME-FR-001.

#### GAME-FR-003: Session Pause and Resume (P0)

A "Pause" button in the top-right corner lets the supervising adult or child interrupt the assessment at any point. Pausing stops the current game and timer and shows a "Resume" / "Exit Session" overlay. "Resume" continues from the exact paused state; "Exit Session" saves session state, returns to the child's profile, and shows a "tap to resume" banner. Returning later (even after closing the browser) prompts resumption from the last game played. Paused sessions expire after 7 days and are marked incomplete.

**Business Rules:** time spent paused is excluded from total session duration; maximum 3 pauses per session (to prevent gaming the system). **Dependencies:** GAME-FR-001, GAME-FR-002.

#### GAME-FR-004: Session Completion and Data Submission (P0)

After Game 7, the system shows a completion screen ("All done! Great work!" plus a localized encouraging message and a "processing" indicator), then runs the finalization pipeline: mark session complete, calculate session-level metrics (duration, completion rate), extract feature vectors from raw event logs (GAME-FR-010), and anonymize data if the parent has not opted into research. Feature vectors are submitted to the ML inference API, the session record is updated with results, and report generation is triggered. If the network is unavailable, data queues for upload when connectivity returns, and the user sees "Report will be ready in 1-2 minutes."

**Business Rules:** a session is marked complete only if all 7 games finished; sessions abandoned early are marked "incomplete" and excluded from inference. **Dependencies:** GAME-FR-002, event logging (GAME-FR-009).

#### GAME-FR-005: Trilingual Audio Instructions (P0)

Every instruction and prompt has native-speaker audio in the child's selected language, with subtitles for accessibility and an adjustable volume slider (default 80%); if audio fails to load, subtitles remain visible. Audio is cached offline after first load. **Dependencies:** language selection in GAME-FR-001.

#### GAME-FR-006: Touch and Click Input Handling (P0)

All interactive elements respond to touch and mouse/trackpad with no double-tap delay. Minimum touch target 44x44px (WCAG); brief highlight/scale feedback on interaction; 10px dead-zone margin near boundaries; supports tap, swipe, and drag (for Pattern Mirror). Input latency must be <100ms (GAME-NFR-001). _Verification: tested on 5+ device types._

#### GAME-FR-007: Adaptive Difficulty Adjustment (P1)

For Letter Rain, Number Jumper, and Color Sequence: difficulty increases after 3 consecutive correct answers and decreases after 3 consecutive incorrect answers, with subtle steps and a difficulty floor so the child can always progress. Every difficulty change is logged for feature extraction, and adaptivity can be disabled via an admin flag for research. Pattern Mirror uses a fixed difficulty curve instead. **Dependencies:** individual game logic.

#### GAME-FR-008: Visual and Auditory Feedback (P0)

Correct answers get a green checkmark/sparkle, a ~200ms chime, and periodic encouragement ("Nice work!") every 5 correct responses. Incorrect answers get a gentle red X or fade-out and a soft, non-harsh sound - never a negative message like "Wrong!". Visual feedback appears &lt;100ms after input, audio <200ms, at &gt;=30 FPS; content is reviewed for cultural appropriateness. **Dependencies:** GAME-FR-006.

### Data Capture

#### GAME-FR-009: Event Logging (Millisecond Precision) (P0)

Every interaction (tap, swipe, state change) is logged as an event object (event_id, session_id, game_id, event_type, performance.now() timestamp, position, stimulus/response values, response latency, device state). Events buffer in memory, persist to IndexedDB every 10 seconds (crash protection), and upload as one JSON payload only at session end.

**Business Rules:** raw events are never sent to the server until the session completes; if the parent has not opted into research, raw events are discarded after feature extraction. **Dependencies:** GAME-FR-001.

#### GAME-FR-010: Feature Extraction (P0)

Raw event logs are processed client-side (TensorFlow.js/JS) into a 200+-dimensional feature vector across seven categories: **temporal** (mean/variance response time, trend), **accuracy** (error rate, correction rate, accuracy by difficulty), **motor** (touch precision, swipe velocity, tremor), **attention** (response drift, distraction recovery, omissions), **persistence** (retry behavior, abandonment), **learning** (performance change across repeats), and **rhythm** (beat synchronization, temporal regularity). Extraction completes in <5s on minimum-spec devices; only the feature vector (never raw events) is uploaded.

**Business Rules:** extraction is deterministic; missing games are null-flagged, not zeroed. **Dependencies:** GAME-FR-009, child age.

#### GAME-FR-011: Age-Based Normalization (P0)

Each feature is z-score normalized against age-specific norms (z = (value - age_mean) / age_std) from a normative database tabulated at 0.5-year increments, interpolating between points; features are left unnormalized with a flag if norms aren't yet available for that age/feature. **Dependencies:** GAME-FR-010, normative database.

### Offline, Performance, and Accessibility

#### GAME-FR-012: Offline Game Caching / PWA (P0)

On first visit, a service worker caches all game bundles (~700KB x 7), images/sprites (~2MB), selected-language audio (~2MB), and the core app (~1.5MB) - total <=15MB compressed. Sessions run fully offline thereafter; an "Offline Mode" indicator shows connectivity state; session data is queued in IndexedDB and uploaded when connectivity returns; the cache auto-updates in the background (30-day expiry) with a reload prompt for critical updates. Initial download requires WiFi/4G.

#### GAME-FR-013: Performance on Low-End Devices (P0)

Target device: ~2GB RAM, quad-core 1.6GHz (e.g., Galaxy A10). Requirements: >=30 FPS for 95% of session time, <100ms input-to-feedback latency (p95), <5s per-game load after caching, <500MB memory use, no crashes over a 20-minute session. _Verification: profiling on target devices._

#### GAME-FR-014: Visual Accessibility (P0)

High-contrast mode (>=7:1 contrast); color never the sole information carrier; scalable fonts (16px min, 24px large mode); alt text on images; tested against color-blindness simulators.

#### GAME-FR-015: Auditory Accessibility (P1)

All audio has simultaneous text subtitles; visual cues (e.g., a green screen-border flash) substitute for audio feedback when muted; captions match the selected language; Story Rhythm adds a vibration fallback on mobile. **Dependencies:** GAME-FR-005.

## \> Sections 3.3-3.8 (Behavioral Data Capture, ML-Based Detection, Report Generation, Dashboard and Analytics, Federated Learning, Offline Mode and PWA detail) are referenced in the table of contents but their detailed content was not present in the source document supplied for this revision; their cross-cutting requirements are captured where referenced elsewhere (Sections 6-9)

# 4\. Detailed Game Specifications

Each game specification covers: cognitive construct, LD detection target, scientific basis, gameplay mechanics, stimulus design, scoring logic, behavioral signals captured, and acceptance criteria.

## 4.1 Game 1: Letter Rain (ፊደል ዝናብ) - GAME-01

| Attribute        | Value                                               |
| ---------------- | --------------------------------------------------- |
| Construct        | Phonological awareness and letter-sound recognition |
| LD Target        | Dyslexia, Processing Speed Deficit                  |
| Scientific Basis | Tallal (2004) phonological processing model         |
| Duration         | ~2-3 min                                            |
| Difficulty       | Adaptive (fall speed, set size)                     |

Fidel characters fall from the top; the child taps the letter matching an audio prompt (new prompt every 3-6s per difficulty). Session = 20 trials. Letters render in high-contrast Ethiopic Unicode, min 32px; fall speed 40-120 px/s, adaptive; audio prompt precedes each letter. Correct = tap matches prompt within the fall window; missed/incorrect taps are logged as errors, with response latency from appearance to tap.

**Signals:** mean/variance response latency, accuracy by letter and difficulty, omission rate, tap precision.

**Acceptance Criteria:** exactly 20 trials; adaptive difficulty follows the 3-correct/3-incorrect rule (GAME-FR-007); all taps/misses logged (GAME-FR-009); fully playable offline once cached.

## 4.2 Game 2: Pattern Mirror (ምሳሌ መስተዋት) - GAME-02

| Attribute        | Value                                     |
| ---------------- | ----------------------------------------- |
| Construct        | Visual working memory and sequence recall |
| LD Target        | Working Memory Deficit, Dyscalculia       |
| Scientific Basis | Baddeley (2000) episodic buffer model     |
| Duration         | ~3 min                                    |
| Difficulty       | Fixed progression                         |

A sequence of colored shapes lights up on a 3x3 grid; the child reproduces it by tapping in order. Sequence length starts at 2, +1 every 2 successful rounds up to max 7; ends after 2 consecutive failures or max length. Grid cells >=80x80px, high-contrast colors plus distinct shapes; each cell highlights 600ms with a 200ms gap. A round passes only on an exact-order match; partial (position-correct) accuracy is also recorded.

**Signals:** max sequence length achieved (memory span), inter-entry timing, position- vs. order-based error pattern.

**Acceptance Criteria:** length increases only after two consecutive correct rounds; termination follows the two-failure/max-length rule; drag input supported alongside tap (GAME-FR-006).

## 4.3 Game 3: Story Rhythm (የታሪክ ምት) - GAME-03

| Attribute        | Value                                            |
| ---------------- | ------------------------------------------------ |
| Construct        | Auditory processing and rhythmic synchronization |
| LD Target        | Dyslexia, ADHD (Inattentive)                     |
| Scientific Basis | Tallal (2004) temporal auditory processing       |
| Duration         | ~2-3 min                                         |
| Difficulty       | Fixed, three tempo stages                        |

A narrated story plays with an embedded beat; the child taps in time (three stages at 60/90/120 BPM). Audio narration pairs with a percussive track in the selected language; a synchronized visual pulse aids accessibility. Synchronization accuracy is the ms offset between tap and beat onset; missed beats (no tap within tolerance) are recorded.

**Signals:** mean/variance sync offset per tempo stage, temporal regularity of taps, missed-beat rate.

**Acceptance Criteria:** all three tempo stages presented in order; vibration fallback on mobile when muted (GAME-FR-015); per-beat offset logged (not just aggregated).

## 4.4 Game 4: Number Jumper (ቁጥር ዝላይ) - GAME-04

| Attribute        | Value                                         |
| ---------------- | --------------------------------------------- |
| Construct        | Numerical cognition and number sense          |
| LD Target        | Dyscalculia                                   |
| Scientific Basis | Dehaene (1992) Triple Code Model              |
| Duration         | ~3 min                                        |
| Difficulty       | Adaptive (number range, operation complexity) |

A character jumps a numbered path; the child taps the correct next number or answer to a comparison/arithmetic prompt across 20 trials (counting, magnitude comparison, simple addition/subtraction, age-scaled). Number range scales with age (4-6 yrs: 1-10; 7-10 yrs: 1-50); numerals shown as digits with spoken audio. Correct/incorrect plus latency recorded per trial; adaptive difficulty per GAME-FR-007.

**Signals:** accuracy by operation type, latency trend (learning curve), error magnitude.

**Acceptance Criteria:** content matches the age-appropriate ranges; 20 trials completed; every response logged with stimulus and value.

## 4.5 Game 5: Color Sequence (የቀለም ቅደም ተከተል) - GAME-05

| Attribute        | Value                                      |
| ---------------- | ------------------------------------------ |
| Construct        | Sustained attention and short-term memory  |
| LD Target        | ADHD (Inattentive), Working Memory Deficit |
| Scientific Basis | Barkley (1997) sustained attention model   |
| Duration         | ~2-3 min                                   |
| Difficulty       | Adaptive (sequence length, speed)          |

Colored tiles flash briefly in sequence; the child selects tiles matching a target color as they appear, with distractor colors interspersed (~2:1 distractor:target) to test selective attention; flash duration 400-800ms. Scoring tracks correct target selections, commission errors (selecting a distractor), and omission errors (missing a target).

**Signals:** commission error rate, omission error rate, response-time variability (attention lapses).

**Acceptance Criteria:** target/distractor tiles distinguishable without relying on color alone (GAME-FR-014); adaptive difficulty per GAME-FR-007; commission/omission errors logged separately.

## 4.6 Game 6: Target Chase (ኢላማ ማሳደድ) - GAME-06

| Attribute        | Value                                             |
| ---------------- | ------------------------------------------------- |
| Construct        | Sustained visual attention and impulse control    |
| LD Target        | ADHD (Hyperactive/Impulsive)                      |
| Scientific Basis | Barkley (1997) continuous performance task model  |
| Duration         | ~3 min                                            |
| Difficulty       | Fixed (constant go/no-go ratio for comparability) |

A target icon appears at randomized intervals (800-2000ms ISI); the child taps only on "go" icons (70% of 60 trials) and withholds on "no-go" icons (30%). Commission errors (tapping no-go) and omission errors (missing go) are recorded.

**Signals:** commission error rate (impulsivity), omission error rate (inattention), reaction-time variability across trials.

**Acceptance Criteria:** go/no-go ratio fixed at 70/30 across all sessions; 60 trials completed; every trial's stimulus type and outcome logged.

## 4.7 Game 7: Word Echo (የቃል ማስተጋባት) - GAME-07

| Attribute        | Value                                       |
| ---------------- | ------------------------------------------- |
| Construct        | Phonological loop and verbal working memory |
| LD Target        | Dyslexia, Working Memory Deficit            |
| Scientific Basis | Baddeley (2000) phonological loop           |
| Duration         | ~2-3 min                                    |
| Difficulty       | Adaptive (word-list length)                 |

The child hears a short word list (2-5 words) and selects the matching picture/word cards in order; list length grows with correct performance (GAME-FR-007). Words are age-appropriate, high-frequency vocabulary with illustrations, played at natural child-directed pace. A round passes only if all words are selected in the correct order; partial recall (correct words, wrong order) is recorded separately.

**Signals:** max word-list length (verbal span), order-error vs. omission-error breakdown, per-word selection latency.

## **Acceptance Criteria:** word lists drawn from a vetted, age-appropriate vocabulary bank per language; list length adjusts per GAME-FR-007; order- and omission-errors logged separately

# 5\. External Interface Requirements

## 5.1 User Interfaces

EarlyMind exposes four role-specific interfaces, all delivered as a single responsive PWA.

| Interface              | Primary Users               | Key Screens                                                     |
| ---------------------- | --------------------------- | --------------------------------------------------------------- |
| Assessment App         | Parents, Teachers, Children | Login, Child Profile, Pre-Assessment, Game Screens, Report View |
| Teacher Dashboard      | Teachers                    | Class Roster, Bulk Screening, Accommodation Guides              |
| School Admin Dashboard | School Administrators       | Aggregate Analytics, Teacher Management, Export                 |
| EAII Admin Console     | EAII Staff                  | System Health, Model Management, Research Export, Audit Logs    |

- **REQ-UI-001 (P0):** All screens render correctly at a minimum viewport width of 320px.
- **REQ-UI-002 (P0):** All interfaces meet WCAG 2.1 AA (CON-ACC-001).
- **REQ-UI-003 (P1):** Dashboards support light and high-contrast themes.

## 5.2 Hardware Interfaces

Touchscreen (capacitive) on phones/tablets; mouse and keyboard on desktop; device speaker for audio playback (output only, no recording); device vibration motor for auditory-fallback feedback (GAME-FR-015) where supported.

## 5.3 Software Interfaces

| Interface                  | Type    | Direction     | Data Exchanged                                    |
| -------------------------- | ------- | ------------- | ------------------------------------------------- |
| Google Gemini API          | REST    | Outbound      | Feature summaries/SHAP values in; report text out |
| Flower Coordination Server | gRPC    | Bidirectional | Model weight updates                              |
| AWS S3                     | REST    | Bidirectional | Static assets, reports, model artifacts           |
| AWS RDS (PostgreSQL)       | SQL/TCP | Bidirectional | All relational application data                   |

## 5.4 Communication Interfaces

All client-server communication over HTTPS (TLS 1.2+); REST API with JSON payloads for synchronous operations; a WebSocket channel for real-time dashboard updates (screening progress, system health); an SMS gateway (carrier-dependent) for OTP delivery.

# 6\. Non-Functional Requirements

## 6.1 Performance Requirements

| ID           | Requirement                             | Target    | Priority |
| ------------ | --------------------------------------- | --------- | -------- |
| PERF-NFR-001 | Game frame rate on minimum-spec devices | \>=30 FPS | P0       |
| PERF-NFR-002 | API response time (p95)                 | <2s       | P0       |
| PERF-NFR-003 | ML inference time per session           | <5s       | P0       |
| PERF-NFR-004 | Report generation time                  | <10s      | P0       |
| PERF-NFR-005 | Initial app load (first visit, WiFi)    | <5s       | P1       |
| PERF-NFR-006 | Dashboard load time                     | <2s       | P1       |

## 6.2 Safety and Security Requirements

- **SEC-NFR-001 (P0):** All traffic encrypted via TLS 1.2+; HTTP redirected to HTTPS.
- **SEC-NFR-002 (P0):** All child data encrypted at rest with AES-256 (CON-PRIV-002).
- **SEC-NFR-003 (P0):** RBAC enforced at the API layer for every endpoint (AUTH-FR-004).
- **SEC-NFR-004 (P0):** OWASP Top 10 vulnerabilities mitigated (SQLi, XSS, CSRF).
- **SEC-NFR-005 (P1):** Automated dependency vulnerability scanning in CI/CD.
- **SEC-NFR-006 (P0):** All administrative actions on child data logged to an immutable audit trail (CON-PRIV-005).

## 6.3 Privacy Requirements

- **PRIV-NFR-001 (P0):** Raw behavioral logs never leave the device unless the parent opts into research (CON-PRIV-001).
- **PRIV-NFR-002 (P0):** Consent is captured, versioned, and re-confirmable at any time.
- **PRIV-NFR-003 (P0):** Right-to-erasure requests fulfilled immediately and irreversibly (AUTH-FR-005).
- **PRIV-NFR-004 (P0):** Teachers and school admins cannot access raw or identifiable behavioral data (CON-PRIV-004).
- **PRIV-NFR-005 (P1):** Research data is de-identified and handled under IRB approval (CON-REG-003).

## 6.4 Quality Attributes

| Attribute       | Requirement                                                      |
| --------------- | ---------------------------------------------------------------- |
| Reliability     | \>=99% uptime during the pilot (excluding scheduled maintenance) |
| Maintainability | Modular codebase; >=70% automated test coverage of core logic    |
| Portability     | Runs on any evergreen browser per Section 2.4.1                  |
| Usability       | SUS score >=68 (success criterion, Section 1.4.4)                |
| Scalability     | Backend auto-scales 2-4 instances under load without downtime    |

## 6.5 Localization Requirements

- **LOC-NFR-001 (P0):** Full UI and audio localization for Amharic, Afaan Oromoo, and Tigrinya (CON-TECH-004).
- **LOC-NFR-002 (P0):** Ethiopic-script text renders correctly via Unicode-compliant fonts.
- **LOC-NFR-003 (P1):** Date, number, and currency formats follow Ethiopian conventions where user-facing.
- **LOC-NFR-004 (P0):** Language can be switched anytime without losing session progress (AUTH-FR-003).

# 7\. Data Requirements

## 7.1 Database Schema

Core relational tables (PostgreSQL 14.x):

| Table           | Purpose                       | Key Fields                                                         |
| --------------- | ----------------------------- | ------------------------------------------------------------------ |
| users           | Parent/Teacher/Admin accounts | user_id, phone_number, role, language, pin_hash                    |
| children        | Child profiles                | child_id, parent_id, name, date_of_birth, language                 |
| schools         | School records                | school_id, name, region, admin_id                                  |
| sessions        | Assessment sessions           | session_id, child_id, start_time, end_time, status                 |
| feature_vectors | Extracted behavioral features | vector_id, session_id, feature_json, normalized_json               |
| predictions     | ML inference results          | prediction_id, session_id, condition, risk_score, confidence       |
| reports         | Generated reports             | report_id, session_id, pdf_url, generated_at                       |
| consents        | Consent records               | consent_id, parent_id, child_id, consent_type, granted_at, version |
| audit_logs      | Administrative action trail   | log_id, actor_id, action, target_id, timestamp                     |

## 7.2 Data Models

Example feature_vector (abridged): { "session_id": "uuid", "age_months": 68, "features": { "letter_rain_mean_latency": 812.4, "pattern_mirror_max_span": 4, "target_chase_commission_rate": 0.12, ... 200+ fields } }

Example prediction: { "session_id": "uuid", "predictions": \[ { "condition": "dyslexia", "risk_score": 0.71, "confidence": 0.83, "shap_top_features": \["letter_rain_mean_latency", "word_echo_span"\] } \] }

## 7.3 Data Flow

Client (event capture -> feature extraction) -> API (feature vector upload) -> ML Service (inference) -> API (store predictions) -> Report Service (SHAP + Gemini) -> Client (report delivery). Raw behavioral events stay on-device unless research consent is granted; only derived feature vectors cross the network boundary by default.

## 7.4 Data Retention and Archival

| Data Type                                  | Retention                        | Notes                             |
| ------------------------------------------ | -------------------------------- | --------------------------------- |
| Session feature vectors                    | Until parent deletion or 3 years | Encrypted at rest                 |
| Raw behavioral events (research-consented) | Duration of IRB approval         | De-identified for research        |
| Generated reports (PDF)                    | Until parent deletion or 3 years | Signed URLs, private S3 bucket    |
| Audit logs                                 | 7 years                          | Anonymized after account deletion |
| Database backups                           | 7 days rolling                   | Automated daily snapshots         |

# 8\. ML Model Specifications

## 8.1 Feature Engineering

Minimum 200 features per completed session across temporal, accuracy, motor, attention, persistence, learning, and rhythm categories (GAME-FR-010); all features normalized by age against the normative database (GAME-FR-011); missing-game features are null-flagged rather than zeroed, to avoid bias.

## 8.2 Model Architecture

Hybrid LSTM + Transformer: a 200+-dimensional normalized feature vector feeds an LSTM encoder (sequential/temporal patterns within each game) and a Transformer encoder (cross-game attention), producing 6 sigmoid outputs for multi-label classification (dyslexia, dyscalculia, ADHD-Inattentive, ADHD-Hyperactive/Impulsive, working memory deficit, processing speed deficit). Uncertainty is quantified via Monte Carlo dropout at inference.

## 8.3 Training Requirements

Training set: 150-300 labeled pilot sessions (CON-SCI-003); ground-truth from validated checklists with Cohen's Kappa >=0.75 (CON-SCI-004); class imbalance addressed via weighted loss or SMOTE-style oversampling; 70/15/15 train/validation/test split stratified by condition and age band; every trained model is versioned, stored in S3, and traceable to the reports it generated.

## 8.4 Evaluation Metrics

| Metric                      | Target    | Rationale                             |
| --------------------------- | --------- | ------------------------------------- |
| Sensitivity (per condition) | \>=80%    | Success criterion, Section 1.4.4      |
| Specificity (per condition) | \>=70%    | Limits false positives (CON-ETH-003)  |
| AUC-ROC                     | \>=0.80   | Overall discriminative ability        |
| Calibration error           | Minimized | Confidence scores must be trustworthy |

## 8.5 Explainability Requirements

Every prediction includes SHAP values for top contributing features (CON-SCI-005), translated into plain-language Amharic for parent reports (Section 3 report generation). The model never outputs a binary diagnosis - only calibrated risk scores with confidence intervals.

# 9\. API Specifications

## 9.1 REST API Endpoints

| Method    | Endpoint                    | Purpose                                |
| --------- | --------------------------- | -------------------------------------- |
| POST      | /api/auth/register          | Register new user (AUTH-FR-001)        |
| POST      | /api/auth/login             | PIN or OTP login (AUTH-FR-002)         |
| GET / PUT | /api/users/me               | View/edit profile (AUTH-FR-003)        |
| DELETE    | /api/users/me               | Account deletion (AUTH-FR-005)         |
| POST      | /api/children               | Create child profile                   |
| POST      | /api/sessions               | Start assessment session (GAME-FR-001) |
| PATCH     | /api/sessions/{id}          | Update/complete session (GAME-FR-004)  |
| POST      | /api/sessions/{id}/features | Upload extracted feature vector        |
| GET       | /api/sessions/{id}/report   | Retrieve generated report              |
| GET       | /api/dashboard/school/{id}  | School aggregate analytics             |

## 9.2 WebSocket Specifications

Endpoint: wss://api.earlymind.et/ws/dashboard. Events pushed: screening.completed, session.progress, system.health. Authenticated via a short-lived token passed at connection time.

## 9.3 ML Inference API

Internal endpoint POST /internal/ml/predict accepts a feature vector and returns per-condition risk scores, confidence, and SHAP values. Target latency <5s (CON-PERF-003). Not exposed publicly - accessible only from the backend within the VPC.

## 9.4 Federated Learning API

A Flower client connects from opted-in devices/browsers to submit model weight updates only; server-side aggregation applies differential privacy before merging into the global model (CON-PRIV-006). No raw data or feature vectors are transmitted through this channel.

# 10\. Testing Requirements

## 10.1 Unit Testing

Minimum 70% code coverage for feature-extraction and scoring logic; all age-normalization functions covered by tests with known input/output pairs.

## 10.2 Integration Testing

End-to-end flow: registration -> assessment -> feature upload -> inference -> report generation; RBAC enforcement tested for every endpoint/role combination.

## 10.3 User Acceptance Testing

UAT with at least 10 users per role (parent, teacher, school admin, EAII staff). Acceptance threshold: SUS score >=68 and >=80% of parents rating the flow "easy" or "very easy" (Section 1.4.4).

## 10.4 Performance Testing

Load testing with 100 concurrent sessions to validate API and inference latency targets; frame-rate profiling on the minimum-spec reference device (Section 2.5.8).

## 10.5 Security Testing

Penetration testing covering authentication, RBAC, and data-at-rest/in-transit encryption; automated dependency and OWASP Top 10 scanning in CI/CD.

# 11\. Deployment and Maintenance

## 11.1 Deployment Architecture

Production follows the AWS architecture in Section 2.4.3, with separate staging and production environments; staging mirrors production configuration at reduced instance sizes.

## 11.2 DevOps Pipeline

CI/CD via GitHub Actions: lint -> unit test -> build -> deploy to staging -> manual promotion to production; infrastructure as code for all AWS resources; automated rollback on failed post-deployment health checks.

## 11.3 Monitoring and Logging

Sentry for application error tracking (DEP-SVC-004); CloudWatch for infrastructure metrics (CPU, memory, latency); centralized, anonymized application logs retained 90 days.

## 11.4 Backup and Recovery

Automated daily RDS snapshots, 7-day retention (Section 2.4.3); S3 versioning enabled on report and model buckets; documented disaster-recovery runbook with a 4-hour RTO and 24-hour RPO.

# 12\. Appendices

## Appendix A: Use Case Diagrams

Primary use cases: (1) parent screens child at home; (2) teacher bulk-screens a class; (3) school admin reviews aggregate analytics; (4) EAII researcher exports anonymized data; (5) EAII engineer retrains and deploys an updated model. Detailed UML diagrams are maintained in the System Architecture Document (Section 2.6).

## Appendix B: Wireframes

Low-fidelity wireframes for the Assessment App, Teacher Dashboard, School Admin Dashboard, and EAII Admin Console are maintained in Figma and referenced from the Developer Onboarding Guide.

## Appendix C: Data Dictionary

A complete field-by-field data dictionary for the tables in Section 7.1 (data types, constraints, nullability) is maintained alongside the database migration scripts and kept in sync with each schema change.

## Appendix D: Cognitive Assessment Framework

| Game           | Construct                                        | Target Condition(s)                        |
| -------------- | ------------------------------------------------ | ------------------------------------------ |
| Letter Rain    | Phonological awareness, letter-sound recognition | Dyslexia, Processing Speed Deficit         |
| Pattern Mirror | Visual working memory, sequence recall           | Working Memory Deficit, Dyscalculia        |
| Story Rhythm   | Auditory processing, rhythmic synchronization    | Dyslexia, ADHD (Inattentive)               |
| Number Jumper  | Numerical cognition, number sense                | Dyscalculia                                |
| Color Sequence | Sustained attention, short-term memory           | ADHD (Inattentive), Working Memory Deficit |
| Target Chase   | Sustained visual attention, impulse control      | ADHD (Hyperactive/Impulsive)               |
| Word Echo      | Phonological loop, verbal working memory         | Dyslexia, Working Memory Deficit           |