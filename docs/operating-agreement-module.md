# Timeline + Operating Agreement + Compliance (Endeavor platform)

Single timeline for the admin console and the client portal, from onboarding to company approval, ending in
**Operating Agreement**, with sub-statuses up to **Archived**. Everything runs on the existing platform, with no
parallel system and no second signature tool.

## Flow

| Stage (`companies.stage`) | Who moves it |
|---|---|
| Onboarding → Documents received → Articles preparation → Filed with the state → Company approved | Admin (Clients → company → **Timeline**) |
| Operating Agreement (automatic right after "Company approved") | Database trigger |

Operating Agreement sub-statuses (`operating_agreements.status`):

1. **pending_generation**: the client portal shows **Generate Operating Agreement** (owner only).
2. **questionnaire**: company data and the Articles are retrieved automatically (state included). The client only confirms or completes. Each question has a neutral explanation box adapted to the state. Answers save automatically.
3. **drafting**: the AI (Claude or ChatGPT through the official API) drafts using **only** the approved clauses of the state. The server validates the draft: every clause present, no extra clauses, names, numbers and percentages kept, no placeholders. A clause that fails validation falls back to the approved model text.
4. **in_review**: Endeavor reviews. Missing essential information, conflicts with the Articles, "I am not sure" answers, a state without approved rules, an S corporation with a foreign member, a C corporation election or a specific purpose go to the **qualified reviewer** (`admins.legal_reviewer`). Review actions:
   - edit a clause (creates a new version);
   - generate a new draft with notes;
   - send the questionnaire back to the client;
   - release the draft to the client.
5. **client_review**: the client reads the PDF, comments per clause, requests corrections or approves the final version (checkbox plus typed name).
6. **approved → signing**: the final PDF is generated (no watermark) and the **existing Endeavor e-signature module** opens automatically with the document loaded and the signature and date fields positioned for each signer. Every member signs, plus any manager who is not a member. Signers sign one at a time: each envelope uses the PDF already signed by the previous signer.
7. **signed → archived**: the signed PDF (with the e-signature certificates) and a compliance evidence PDF are saved in the company folder (`client-docs`, `company_documents`). The timeline moves to Archived in both portals.

Updates appear on their own in both portals through **Supabase Realtime** (`operating_agreements`, `company_timeline`, `companies`).

## Document

- Letter size, 1-inch margins, Times, justified text.
- Title, company identification, introduction, definitions, numbered articles (I–X) and sections (1.1, 1.2…).
- Clean page breaks (a heading never sits alone at the bottom; signature blocks are never split), running header, "Page x of y".
- Signature page and Schedule A (members, contributions, percentages).
- Drafts carry a "DRAFT FOR REVIEW" watermark; the final version does not.
- Texas: the document states that it is the "company agreement" under the Texas Business Organizations Code.

## Compliance (Admin → Compliance)

- **Operating Agreements**: queue and review screen. Tabs:
  - clauses with "AI / model / edited", the approved model text and links to the statutes;
  - answers with their sources (Articles / company record) and consents;
  - comments, versions (AI provider and model, rules version, PDF SHA-256), signatures and trail.
- **Audit Reports**: filters by period, client, company, role, action and actor; export to **CSV** and **PDF**; **integrity check** of the hash chain.
- **Legal rules and reviewers**: rule sets by state with version and SHA-256, approval and retirement by the qualified reviewer, list of reviewers.
- **Privacy**: whether IP and device go into new records. The e-signature always keeps the signer IP in its certificate.

The audit log (`audit_log`) is append-only: triggers block UPDATE, DELETE and TRUNCATE, and every row stores the hash of the previous one. It records:

- portal access;
- timeline views and stage changes;
- document views and downloads (mirrored from `doc_access_log`);
- every Operating Agreement action, with document version, AI provider/model/request ID, prompt hash and rules version;
- consents (AI and data use, questionnaire submission, final approval with typed name);
- e-signature events, mirrored from `envelope_events`, with the signer's IP and device;
- archiving;
- approval of rules and reviewers;
- report views and exports.

## Personal data

- No SSN, ITIN, passport or bank data in the questionnaire.
- Member e-mails are used only for the signing link and are not printed in the document.
- The AI receives only facts that go into the agreement (names, percentages, contributions, business address, the Articles PDF to read the company data). E-mails are not sent to it.
- Drafts live in the private bucket. The client only sees the version released to them.
- Collaborators see the timeline but not the Operating Agreement.
- Every write goes through the `oa` function, which validates and audits it. Row-level security only allows reads.

## Modules reused

| Need | Existing module |
|---|---|
| Signature | `envelopes`, `envelope_events`, `esign` function, `sign.html`/`sign.js` (+ `oa_id` and `signer_index` columns; `sign.js` calls `oa.envelope_signed` and offers "Back to the portal") |
| Archive | `client-docs` bucket + `company_documents` (formation / compliance) |
| Access log | `doc_access_log` (mirrored into `audit_log`) |
| Notifications | `admin_events` (bell) with the new kinds `oa_review`, `oa_client`, `oa_signature`, `oa_archived` |
| Permissions | `is_admin`, `my_client_role`, `can_access_company`, `is_aal2` (MFA) |
| PDF viewer | `pdfview.js` (EPdf) |
| Fixed layout | `fit-layout.js` |

New files:

- `oa-rules.js`: questions, explanations, clauses, references and validation;
- `oa-render.js`: PDF rendering;
- `oa-ui.js`: timeline and labels in PT/EN/ES;
- `client-oa.js`: the client side;
- `admin-oa.js`: Compliance and the timeline;
- `supabase/oa/index.ts`: the function;
- migrations `oa_1` to `oa_4`.

## Pending dependencies

1. **AI key**: in Supabase → Edge Functions → Secrets, add `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` plus `OA_OPENAI_MODEL`. Optionally add `OA_MODEL`. Without a key, the draft is assembled only from the approved model texts and is marked "ai_not_configured" in the review.
2. **Attorney approval of the rules** (WY, FL, DE, TX, version 2026.11-1):
   - designate the qualified reviewer in Compliance → Legal rules and reviewers;
   - load the rules ("Load/update system rules");
   - review the questions, explanations, model clauses and references;
   - approve each state.

   Until then every draft goes to the reviewer.
3. **E-mail to the other signers**: with `RESEND_API_KEY` (and `OA_EMAIL_FROM`) the function sends the signing link itself. Without it, the admin bell asks Endeavor to send it from Assinaturas → "Enviar e-mail".
4. **AI provider contract**: zero data retention / DPA with Anthropic or OpenAI before using real data.
5. **Other states**: add the state to `oa-rules.js`, load and approve it. Until then a request for that state goes to review.
6. **Legal review** of the consent texts (AI and electronic signature) and of the privacy policy, to mention AI processing.
