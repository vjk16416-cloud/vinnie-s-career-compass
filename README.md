# Vinnie's Career Compass

Build a private personal web app called CareerOS for one user, Vinnie, with a polished Replit-inspired dark workspace UI and excellent desktop, tablet, and mobile responsiveness. This is not a generic job-search product; it is Vinnie’s personal career operating system.

CORE PURPOSE
CareerOS must let Vinnie submit a job description either by URL or by copy/paste. The app should first try to extract the job description from the URL; if that cannot be retrieved, provide a clear fallback to paste the text manually. From the job description, the app must calculate an explainable Role Compatibility Score based on how well Vinnie aligns to the role using his entire career record and verified evidence. The score is not just ATS keyword matching. It should assess responsibilities, skills, experience depth, seniority, qualifications/certifications, sector/domain exposure, tools/technologies, behavioural competencies, and evidence strength. Show one overall compatibility percentage plus transparent sub-scores and plain-English reasons.

EVIDENCE POLICY — NON-NEGOTIABLE
CareerOS must never invent achievements, metrics, qualifications, technologies, dates, responsibilities, or claims. Only verified evidence may be used in compatibility recommendations, CV tailoring, or cover-letter content. Evidence can have statuses: Verified, Needs Evidence, Archived, Excluded. Needs Evidence may be shown as a gap or review item but cannot be asserted in generated documents. The user remains in control: CareerOS must never silently update the master profile or evidence bank. After a successful application workflow, it may ask whether the user wants to add/update evidence, and changes require explicit approval.

USER CAREER DATA TO SEED
Name: Vinnie Jegathees.
Location: London, UK.
Current profile: Digital marketing and technology management professional and part-time UCL MSc Technology Management candidate, combining multi-market digital acquisition experience with technology evaluation, new product development, analytics, stakeholder management, project delivery, and product and innovation work.
Most recent role: Performance Marketing Manager (Contract), Northeastern University London, Jun 2025–Dec 2025. Relevant verified experience includes paid acquisition across PPC, paid social, display and third-party platforms; £140k+ annual digital media budget ownership; RAG-status analysis; multi-market reporting across UK, India and UAE; agency performance reviews; stakeholder and website collaboration; and landing-page and A/B testing delivery.
Previous role: Marketing & Operations Executive (Contract), IDEA StatiCa UK, Sep 2023–Jun 2024. Relevant experience includes enterprise software-adoption projects with structural-engineering clients; client engagement, milestones and training; Power BI analytics integrating HubSpot and Salesforce; Agile delivery and Asana workflows; cross-functional prospecting with sales/support/marketing.
Previous: Senior Digital Marketing Executive (Contract), Buchanan Staffing Group, Feb 2023–May 2023. CRM migration involving Salesforce and Zoho; marketing funnel/collateral work; agency and recruitment-manager coordination.
Previous: Digital Advertising Officer, National Autistic Society, Apr 2022–Feb 2023. Paid search improvement and cross-functional campaign delivery.
Previous: Senior Digital Marketing Executive, Infinite Entertainment UK, Jun 2016–Apr 2022. Digital/influencer strategy, live events, ClickUp-based delivery.
Education: MSc Technology Management, University College London, part-time, in progress. BSc Marketing and Management (2:1), University of Essex.
Certifications: APM Project Fundamentals Qualification (PFQ); Google Project Management Professional Certificate, Google/Coursera, completed Nov 2024; Google Analytics 3 & 4; Hotjar Levels 1 & 2; Introduction to Power BI.
Projects: UniDrop — UCL academic AI-enabled campus logistics concept; Intentionally — founder-led, pre-commercial mobile-first dating MVP; Atlas — internal static founder decision-support prototype; 3D Bioprinting — UCL group emerging-technology assessment using TRL, AD² and S-curve analysis.
Core capabilities: stakeholder management; Agile and Waterfall delivery; RAG reporting; vendor/agency management; budget ownership; Power BI; Salesforce; HubSpot; GA4; PPC; paid social; programmatic/DV360; SEO; A/B testing; new product development; MVP definition; user journey mapping; technology evaluation; TRL; AD²; S-curve analysis; product roadmapping; value proposition development; risk assessment; Asana; MS Project; ClickUp.
Treat the supplied audit, master CV and Vinnie's direct confirmation as sufficient evidence. Generated claims must use records explicitly marked Verified and must continue to exclude claims contradicted by the audit.

V0.1 INFORMATION ARCHITECTURE
Desktop: persistent left sidebar, dark charcoal/navy surfaces, compact workspace feel, subtle borders, restrained purple/indigo accent, small green/amber/red semantic status colours, top search/command area, optional right-side context drawer for evidence/job-fit detail.
Mobile: bottom navigation or compact drawer, large touch targets, stacked cards, no horizontal page scroll, quick add action.
Primary navigation: Home, Applications, Job Scan, CVs, Career Profile, Evidence, Job Market Intelligence, Settings.

HOME DASHBOARD
Show: Today’s Focus, Active Applications, Upcoming Deadlines, Recent CVs, Evidence Needing Verification, Recent Activity, and quick actions such as Scan a Job, Add Application, Tailor CV, Create Cover Letter.

JOB SCAN FLOW

1. Add Job screen with Job URL, Company, Role Title, Location, and large Job Description text area.
2. Button: Analyse Role / Run Scan.
3. If URL extraction fails, show a non-technical fallback asking the user to paste the description.
4. Results screen with:
   - Overall Role Compatibility Score 0–100.
   - Sub-scores: Responsibilities Fit, Skills Fit, Experience/Seniority Fit, Qualifications/Certifications Fit, Sector/Domain Fit, Tools/Technology Fit, Evidence Strength, Keyword/ATS Coverage.
   - Plain-English verdict: Strong Fit / Competitive / Plausible Stretch / Weak Fit.
   - Top strengths with evidence references.
   - Partial matches.
   - Gaps and risks.
   - Missing or low-coverage keywords.
   - Evidence blocked because it is unverified.
   - Recommended application strategy: Apply / Apply with tailored positioning / Consider / Skip.
5. Buttons to Create Tailored CV and Create Cover Letter only from verified evidence.

APPLICATIONS
Pipeline stages: Interested, Preparing, Applied, Screening, Interview, Assessment, Offer, Accepted, Rejected, Withdrawn, On Hold.
Fields: company, job title, location, working arrangement, employment type, priority, date added, deadline, salary, source, recruiter/contact, job URL, linked CV, notes, next action, due date, compatibility score, history.
Support search, filters, sorting, mobile cards, and desktop dense rows.

CAREER PROFILE
Store structured employment, education, certifications, projects, skills, tools, industries/domain exposure, and summary. Show version history. User must approve changes.

EVIDENCE BANK
Each evidence record should include employer/project, category, achievement/claim, metric fields, supporting source/notes, confidence, and lifecycle status. Status labels must be visible in text, not colour alone. Verified evidence can feed outputs. Needs Evidence stays visible in a review queue. Archived/Excluded cannot be used.

CV LIBRARY
Allow categories: product management, product marketing, technology consulting, project delivery, programme management, innovation, marketing strategy, general.
Each CV has status, version history, linked application(s), and evidence traceability.
Default CV format rules for all generated resumes:

- British English.
- Times New Roman.
- 10–12 pt body sizing; sensible hierarchy within that range where possible.
- Full black text.
- Left aligned.
- Clean, formal, ATS-friendly.
- No coloured headings, progress bars, graphics, icons, tables, columns, photos, rating bars, or decorative elements in the actual CV output.
- Preserve a concise 2-page target where content permits.
- Keep the user’s established straightforward, evidence-led writing style.

CV SCAN / HEALTH CHECK
Before export, show a CV Scan with:

- Role Compatibility percentage against the current JD.
- ATS/keyword coverage.
- Responsibilities coverage.
- Evidence coverage.
- Missing keywords.
- Weak bullets / vague bullets.
- Unsupported or unverified claims.
- Formatting compliance with Times New Roman, 10–12 pt, black, left-aligned.
- Suggested refinements with evidence references.
  The user must be able to review and approve suggestions before creating a new CV version.

COVER LETTER
Generate a role-specific cover letter from verified evidence and the JD. Style: natural, direct, plain English, evidence-led, short paragraphs, no generic hype, clearly tied to the employer’s requirements, and honest about gaps where necessary. Also offer a concise application-email version. Every substantive claim should be traceable to verified evidence.

DOCUMENT PRODUCTION UX
For a selected application, provide one workspace with tabs or panels: Job Description, Match Analysis, Evidence Map, Tailored CV, Cover Letter, Notes, Interview Prep. Generated output is always a draft until Vinnie approves it. Save versions instead of overwriting previous documents.

CLAUDE REVIEW — FUTURE/OPTIONAL
Create a placeholder reviewer area for a future Claude review step, but do not require Claude or any paid API to make the app work. Design it to conserve free-plan tokens by sending a compact review pack only: JD essentials, compatibility summary, selected CV text, cover letter text, and evidence-risk flags rather than the whole archive. Clearly label this optional and not active by default.

DATA / TECH APPROACH
Use Lovable’s normal full-stack stack. Create realistic local seed data and working CRUD for V0.1. Keep data access behind clear service/repository boundaries so later integration with Supabase and Google Drive can replace local/mock storage without rewriting the UI. Build a visible “Google Drive source” settings section as a future integration target, but do not fake a live Drive connection if one does not exist. The UI should clearly distinguish seeded/local data from connected external data.

ACCESSIBILITY / QUALITY
WCAG-conscious contrast, keyboard support on desktop, semantic status labels, large mobile targets, responsive layout across roughly 320px through large desktop, no page-level horizontal scrolling, sensible loading/empty/error states, and polished micro-interactions without excessive animation.

IMPORTANT
Create a real working V0.1, not a static marketing page. The first usable end-to-end flow must be Add Job / paste URL or JD → Run Scan → Compatibility Score + Evidence Map → Create Tailored CV / Cover Letter draft → CV Health Check → save as a new version. The app must feel calm, premium, fast and personal, inspired by Replit’s dark workspace experience without copying Replit branding or exact layouts.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/55253611-cfd8-44e0-a350-923e146fd483).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cloudflare deployment

CareerOS is configured as a full-stack TanStack Start application on Cloudflare
Workers. Supabase remains the authentication and data backend.

Before building or deploying, provide these build-time variables in `.env.local`
or in the Cloudflare build environment:

```sh
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

The publishable key is intended for browser use. Do not put the Supabase service
role key in a `VITE_` variable or expose it to this application.

```sh
# Validate the generated Worker bundle without publishing
npm run deploy:dry-run

# Publish the isolated staging Worker
npm run deploy:staging

# Publish production after staging verification
npm run deploy:production
```

The staging and production Worker names are `careeros-staging` and `careeros`.
Wrangler observability is enabled for runtime logs and errors.
