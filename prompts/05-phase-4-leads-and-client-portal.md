# Prompt 05 · Phase 4: Leads and the full client portal

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 15 and 16, and UI spec section 5.7 (client portal).

Build:

1. **Leads webhook** `POST /api/leads/inbound` for Make.com: secret header, rate limited, payload as product spec
   section 15 describes, duplicate check by phone (adds an enquiry to the existing lead). Document the exact JSON in
   `docs/leads-webhook.md` so Krishna can configure Make.com.
2. **Leads board:** stages, drag between columns, timeline, Log call, Open WhatsApp (wa.me link), required next
   follow-up, untouched timers (amber at 30 minutes, red at 2 hours, notify the assignee), lost reasons.
3. **One quote path:** Start BOQ from a lead creates a draft project and BOQ; Won converts it with no retyping.
4. **Lead reports:** by source and campaign, stage conversion, time to first contact, won value by month, lost reasons.
5. **Client portal** at `/c/[token]`: Estimate, Progress, Payments, Documents, Snags (can raise), Handover (pack,
   sign-off). Email code on first open per device, remembered for 30 days; revoke and reissue links.

Done when: a test lead reaches the board within 5 seconds; the client-safety test passes for every portal response;
a client link cannot open another project by changing any id.
