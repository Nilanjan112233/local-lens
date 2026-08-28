# LocalLens personal workflow

LocalLens is your research and sales desk. It finds possible website-service prospects and helps you decide what to offer. It does not build the website, contact the prospect, accept payment, or make business decisions for you.

## Daily routine

### 1. Start with Today

Check overdue and upcoming follow-ups, new opportunities, proposals, and recent activity. Treat dates as reminders; LocalLens does not send notifications outside the dashboard.

### 2. Discover carefully

Use Standard depth for normal research. Narrow by category when you already know the niche. Use Deep only when the extra Google Places requests are worthwhile. A result is a candidate because its source listing lacks a website field—it is not yet a proven lead.

### 3. Save only plausible prospects

Open the listing and check:

- The business is operating and the name/address/phone match.
- Reviews look real and recent enough to indicate demand.
- The service could realistically benefit from an owned website.
- You can identify a respectful and lawful contact route.

Archive weak or irrelevant prospects early so the pipeline stays useful.

### 4. Verify the website gap

Run website verification before calling a lead qualified. Review every candidate presence:

- `confirmed_no_owned_website`: evidence strongly supports a true gap.
- `social_only`: the business appears to rely on social or directory pages.
- `broken_or_outdated_website`: discuss repair/replacement only after manually opening it.
- `owned_website_found`: normally disqualify or reassess the service opportunity.
- `manual_verification_required`: investigate manually; do not claim the business has no website.

### 5. Use AI as an analyst, not as proof

Run AI analysis after verification. Keep the useful parts—customer needs, missing digital capabilities, competitor lessons, pages, features, and questions—but confirm all business-specific facts yourself. Never repeat a generated claim that you cannot support.

### 6. Plan human outreach

Generate drafts only after reviewing the evidence. Personalize the language, remove guesses, and contact the prospect yourself. Record the contact date and follow-up. If they decline or request no contact, enable do-not-contact immediately.

Avoid spam, deceptive personalization, guaranteed-results language, or pretending you already built something for them. Lead with a specific observation and a short question.

### 7. Prepare, then actually send, a proposal

Package prices are starting points. Confirm scope, content responsibility, revisions, third-party fees, schedule, ownership, payment milestones, and support before delivery. Saving creates `proposal_draft`; manually change the stage to `proposal_sent` only after the client receives it.

### 8. Build outside LocalLens after agreement

Only begin implementation after written acceptance and the agreed deposit. Use the delivery checklist to track the work you perform with your normal design/development tools. LocalLens stores the checklist but does not create or deploy the site.

### 9. Close the record honestly

Use `won`, `lost`, `delivered`, or `maintenance` based on what actually happened. Record a loss reason so future targeting improves. Proposal value is pipeline value—not revenue until payment is received and recorded through your normal accounting process.

## Weekly maintenance

- Export JSON and create a SQLite backup.
- Review do-not-contact records and overdue follow-ups.
- Archive stale leads.
- Check Places and Gemini usage against configured limits.
- Review package pricing against your real delivery cost and time.
- Inspect lost reasons to refine categories, thresholds, and pitch angles.

## Practical income focus

Favor prospects where reputation, demand, contactability, and a verified digital gap align. A smaller list of well-researched businesses is more valuable than a large unverified list. Your income will depend on outreach quality, trust, pricing, delivery, and client fit; LocalLens cannot predict or guarantee it.
