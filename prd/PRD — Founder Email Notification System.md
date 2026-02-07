PRD — Founder Email Notification System

(AppServer + AdminServer, Template-Driven, HTML, UTM-Injected)

1. Objective

Implement a founder-facing transactional + scheduled email notification system triggered from two servers:

AppServer → user & product lifecycle events

AdminServer → approval + daily summary

All emails must:

Use predefined templates

Be HTML beautified

Include deep links

Automatically inject UTM parameters

Be reliable, auditable, and extensible

2. Scope (Strict)
IN SCOPE

✅ Welcome email on account creation
✅ Product submission email
✅ Product approval email
✅ Daily product report email (9:00 AM, hardcoded)
✅ Template-driven HTML emails
✅ Deep links with UTM injection
✅ Split responsibility between AppServer & AdminServer

OUT OF SCOPE

❌ Marketing campaigns
❌ User email preferences
❌ Retry queues / analytics
❌ A/B testing
❌ Admin UI for editing templates
❌ SMS / Push

3. Event → Email Mapping
Event	Triggering Server	Email Type
Account created	AppServer	Welcome Email
Product submitted	AppServer	Submission Confirmation
Product approved	AdminServer	Approval Notification
Daily summary (9 AM)	AdminServer	Daily Product Report
4. Architecture Overview
AppServer
 ├─ User Created
 ├─ Product Submitted
 └─ Calls Email Service

AdminServer
 ├─ Product Approved
 ├─ Daily Cron (9:00 AM)
 └─ Calls Email Service

Shared Email Engine
 ├─ Template Resolver
 ├─ HTML Renderer
 ├─ UTM Injector
 └─ SMTP / Email API Sender

5. Core Design Principles

No hardcoded HTML in business logic

All emails = Template + Data

Server decides WHEN, template decides HOW

UTM injection is mandatory and automatic

AdminServer and AppServer are isolated but consistent

6. Functional Requirements
FR-1: Welcome Email (AppServer)

Trigger:
Immediately after successful account creation

Template: WELCOME_FOUNDER

Content Includes:

Founder name

Clicktory value proposition

Primary CTA: “Submit your first product”

Secondary CTA: “Explore launches”

Deep Links:

/submit-product

/discover

FR-2: Product Submission Email (AppServer)

Trigger:
When founder submits a product

Template: PRODUCT_SUBMITTED

Content Includes:

Product name

Status: “Under Review”

Expected approval timeline

CTA: “Track status”

Deep Link:

/founder/products/{productId}

FR-3: Product Approval Email (AdminServer)

Trigger:
When admin marks product as APPROVED

Template: PRODUCT_APPROVED

Content Includes:

Product name

Go-live confirmation

CTA: “View live product”

CTA: “Share your launch”

Deep Links:

/product/{slug}

/share/{productId}

FR-4: Daily Product Report Email (AdminServer)

Trigger:
Hardcoded cron on AdminServer
⏰ Every day at 9:00 AM (server time)

Template: DAILY_PRODUCT_REPORT

Content Includes:

Total products approved yesterday

Top 3 launches

CTA: “View all launches”

Deep Link:

/today

7. Email Template System
7.1 Template Definition (DB or Filesystem)
{
  "templateKey": "PRODUCT_APPROVED",
  "subject": "🚀 Your product is live on Clicktory",
  "htmlFile": "product_approved.html",
  "isActive": true
}

7.2 HTML Requirements

Inline CSS only

Mobile responsive

Dark-mode safe colors

Button-based CTAs

No external JS

Hosted images only (CDN)

8. Template Variables
Supported Variables
{{founderName}}
{{productName}}
{{productUrl}}
{{dashboardUrl}}
{{date}}


No conditionals in Phase 1.

9. UTM Injection (Mandatory)

Every link must be rewritten automatically.

UTM Rules
utm_source=email
utm_medium=notification
utm_campaign={templateKey}
utm_content={cta_name}

Example
/product/ai-writer
→ /product/ai-writer?utm_source=email&utm_medium=notification&utm_campaign=PRODUCT_APPROVED&utm_content=view_product


UTM logic must live in shared email utility, not per template.

10. Backend Interfaces
AppServer → Email Engine
sendEmail({
  templateKey: 'WELCOME_FOUNDER',
  to: 'founder@email.com',
  data: { founderName }
})

AdminServer → Email Engine
sendEmail({
  templateKey: 'DAILY_PRODUCT_REPORT',
  to: 'founder@email.com',
  data: { count, products }
})

11. Cron Specification (AdminServer)

Hardcoded cron: 0 9 * * *

Single execution per day

No retries

Failure → logged only

12. Failure Handling

Email failure must NOT break:

Account creation

Product submission

Product approval

Failures logged with:

templateKey

recipient

error message

13. Security & Compliance

No secrets in templates

SMTP / API keys only on server

No PII logged beyond email

HTTPS links only

14. Acceptance Criteria

✅ Founder receives welcome email on signup
✅ Product submission email sent immediately
✅ Approval email sent from AdminServer
✅ Daily report sent at 9:00 AM
✅ All emails render correctly in Gmail
✅ All links include correct UTM params
✅ AppServer and AdminServer both work independently

15. Final Instruction for Antigravity (DO NOT IGNORE)

Build exactly what is specified above.
Do not add retries, preferences, analytics, or UI.
Assume Node.js servers, shared email utility, SMTP or API-based sender.
Focus on correctness, separation of concerns, and clean extensibility.