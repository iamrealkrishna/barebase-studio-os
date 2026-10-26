/**
 * Every screen and its route, from docs/screens-and-journeys.md.
 *
 * Screens imported from BOQ Studio are marked `live` and render the real feature.
 * Until each other screen is built, its route renders a placeholder from this list:
 * the title, who uses it, what it will do, the spec sections and a link to the
 * mock-up. Routes follow the screens file (decisions.md, kit v2 question 1).
 */

export type Shell = "app" | "project" | "site" | "client" | "auth";

export type Screen = {
  key: string;
  title: string;
  /** Route pattern, with [id], [token] and so on for dynamic segments. */
  route: string;
  shell: Shell;
  usedBy: string;
  does: string;
  spec: string;
  phase: number;
  /** File names in docs/ui/screens (or docs/ui/reference, prefixed "reference/"). */
  mockups: string[];
  /** Set when the route isn't its own screen in screens-and-journeys.md, e.g. a tab of one. */
  partOf?: string;
  /**
   * Set when the route already works: a screen imported from BOQ Studio. Its page is the
   * real feature, not a placeholder; the value says what it does today.
   */
  live?: string;
};

/** Where a placeholder loads its mock-up image from (served from docs/ui by /mockups/[...file]). */
export function mockupSrc(file: string): string {
  return file.startsWith("reference/") ? `/mockups/${file}` : `/mockups/screens/${file}`;
}

export const SCREENS = [
  // ---- Sign in and global
  { key: "login", title: "Sign in", route: "/login", shell: "auth", usedBy: "Everyone", does: "Email and password, \"email me a sign-in link\", forgot password, and a link for clients to their portal. Five wrong tries locks the account for 15 minutes.", spec: "PS 21", phase: 0, mockups: ["Login.png"], live: "BOQ Studio sign-in (email and password)" },
  { key: "invite", title: "Accept invite", route: "/invite/[token]", shell: "auth", usedBy: "New team members", does: "Set a password from the Admin's invite link (valid 7 days).", spec: "PS 4, 21 · UI 3", phase: 0, mockups: ["Login.png"], partOf: "Sign in" },
  { key: "reset", title: "Reset password", route: "/reset/[token]", shell: "auth", usedBy: "Everyone", does: "Choose a new password from the emailed link (valid 30 minutes, single use).", spec: "PS 21 · UI 3", phase: 0, mockups: ["Login.png"], partOf: "Sign in" },
  { key: "home", title: "Home", route: "/", shell: "app", usedBy: "Everyone (content by role)", does: "Greeting, stat cards, recent projects, leads pipeline, finance snapshot, team load, activity and \"Waiting on you\". New lead and New project.", spec: "PS 16 · UI 5.1", phase: 5, mockups: ["Main.png"] },
  { key: "insights", title: "Insights", route: "/insights", shell: "app", usedBy: "Admin, COO, Finance", does: "Company summary: contract value, collected, billed-unpaid, unbilled, vendor payables, gross margin; cash in vs out by month; billed-unpaid by age; who owes us and whom we owe; project health.", spec: "PS 16", phase: 5, mockups: ["Insights.png"] },
  { key: "notifications", title: "Notifications", route: "/notifications", shell: "app", usedBy: "Everyone", does: "The bell's list grouped Today and This week; every row opens the exact item. Overdue items also go by email at 9 am.", spec: "PS 16", phase: 5, mockups: ["Notifications.png"] },
  { key: "approvals", title: "Approvals", route: "/approvals", shell: "app", usedBy: "Approvers", does: "Waiting items with the request on the right: money context, approval path, Approve, Hold and Reject (Hold and Reject need a note). On a phone, a card per item with Approve and Send back. Reached from \"n to approve\" in the top bar.", spec: "PS 12 · UI 5.6", phase: 2, mockups: ["Approvals.png", "PhoneApprovals.png"] },

  // ---- Leads
  { key: "leads", title: "Leads", route: "/leads", shell: "app", usedBy: "Pre-sales", does: "Board: New → Contacted → Site visit booked → Proposal sent → Won / Lost. Response timers amber at 30 minutes, red at 2 hours.", spec: "PS 15", phase: 4, mockups: ["Leads.png"] },
  { key: "lead", title: "Lead detail", route: "/leads/[id]", shell: "app", usedBy: "Pre-sales", does: "Stage stepper, details, owner, activity log, Log call, Book site visit, Start BOQ, Mark won → Create project.", spec: "PS 15", phase: 4, mockups: ["LeadDetail.png"] },
  { key: "project-new", title: "New project", route: "/projects/new", shell: "app", usedBy: "Pre-sales, Design lead", does: "Three steps: client and site (prefilled from a won lead with ?lead=), team, money and payment stages. Creates the next BB-26-0xx code.", spec: "PS 6, 15", phase: 1, mockups: ["NewProject.png"] },

  // ---- Projects
  { key: "projects", title: "Projects", route: "/projects", shell: "app", usedBy: "Everyone (own projects unless Admin)", does: "All projects with stage, progress and money health. New project.", spec: "PS 6 · UI 5.2", phase: 1, mockups: ["Projects.png"], live: "BOQ Studio's project list: add, duplicate, open a project's BOQ" },
  { key: "overview", title: "Overview", route: "/projects/[id]", shell: "project", usedBy: "Project team", does: "Header with client and stage, key numbers, links into every tab. \"Client view\" opens what the client sees.", spec: "PS 6 · UI 5.3", phase: 1, mockups: ["ProjectOverview.png"] },
  { key: "files", title: "Files", route: "/projects/[id]/files", shell: "project", usedBy: "Project team", does: "Nine folders (2D Layout / Adaptation, 2D Raw Files, 3D Layout / Adaptation, 3D Raw Files, Client Facing Documents, Vendor Facing Documents, Production Drawings, Site Photos, Handover; decision 21). The same file name stacks as a new version. Freeze design.", spec: "PS 9", phase: 1, mockups: ["Files.png"] },
  { key: "boq", title: "BOQ", route: "/projects/[id]/boq", shell: "project", usedBy: "Designers, Design lead", does: "Room sections, items, cost and margin toggle (permission), client and internal PDFs, Send to client.", spec: "PS 8 · UI 5.4", phase: 1, mockups: ["BOQ.png"], live: "BOQ Studio's builder: sections, items, custom items, dimensions, count, discount, GST, scope, notes, photos, cost and margin (Admin only), PDFs" },
  { key: "boq-client-view", title: "Client view", route: "/projects/[id]/boq/client-view", shell: "project", usedBy: "Project team", does: "Preview of exactly what the client sees for this BOQ.", spec: "PS 8 · UI 3, 5.4", phase: 1, mockups: ["BOQ.png"], partOf: "BOQ", live: "Preview of the client's view, with the share links" },
  { key: "boq-review", title: "Client review", route: "/projects/[id]/boq/review", shell: "project", usedBy: "Design lead, designers on the project", does: "Every line with the client's verdict and comment beside it, editable in place.", spec: "PS 8 · UI 3, 5.4", phase: 1, mockups: ["BOQ.png"], partOf: "BOQ", live: "Client Review: the client's verdicts and comments beside each line, editable in place" },
  { key: "boq-versions", title: "Versions and approvals", route: "/projects/[id]/boq/versions", shell: "project", usedBy: "Project team", does: "Every version and change order; compare any two versions.", spec: "PS 8 · UI 3, 5.4", phase: 1, mockups: ["BOQ.png"], partOf: "BOQ", live: "Versions, client links, change orders and the audit log with its PDF export" },
  { key: "boq-send", title: "Send BOQ to client", route: "/projects/[id]/boq/send", shell: "project", usedBy: "Design lead", does: "What changed since the last version (shown to the client too), message, WhatsApp and email, a server check for no cost in the client version. Send locks the version and tracks it in Sent & due with a review date.", spec: "PS 8, 11B", phase: 1, mockups: ["BOQSend.png"] },

  // ---- Project money
  { key: "project-finance", title: "Finance", route: "/projects/[id]/finance", shell: "project", usedBy: "Design lead, Finance", does: "Sold, received, paid and margin; alerts; room-by-room cost-to-complete; client payment schedule with Create proforma on each milestone-linked stage; vendor payments in progress.", spec: "PS 11 · UI 5.5", phase: 2, mockups: ["Finance.png"] },
  { key: "finance-vendors", title: "Vendors and bills", route: "/projects/[id]/finance/vendors", shell: "project", usedBy: "Design lead, Finance", does: "Vendor table (ordered, billed, paid, due), the selected vendor's POs and bills, Record bill, New PO, export ledger.", spec: "PS 10, 11 · UI 5.8", phase: 2, mockups: ["Vendors.png"] },
  { key: "finance-payments", title: "Client payments", route: "/projects/[id]/finance/payments", shell: "project", usedBy: "Finance", does: "Receipts, outstanding (incl. GST), Record a payment against a proforma, which closes it in Sent & due, sends a receipt and writes a ledger entry.", spec: "PS 11", phase: 2, mockups: ["ClientPayments.png"] },
  { key: "finance-expenses", title: "Project expenses", route: "/projects/[id]/finance/expenses", shell: "project", usedBy: "Design lead, Site", does: "Small site spends against the site-expense budget, a status per item, added from a phone.", spec: "PS 11", phase: 2, mockups: ["Expenses.png"] },
  { key: "proforma-new", title: "New proforma invoice", route: "/projects/[id]/finance/proforma/new", shell: "project", usedBy: "Finance, Design lead", does: "Pick a stage or change order, due terms and recipients; live letterhead preview with CGST and SGST and the amount in words; Send.", spec: "PS 11B · UI 5.12", phase: 2, mockups: ["ProformaCreator.png"] },
  { key: "po-new", title: "New purchase order", route: "/projects/[id]/finance/po/new", shell: "project", usedBy: "Design lead", does: "Vendor, BOQ lines with checkboxes, order vs selling rate and margin, room budget left, over-budget warning, terms, submit for approval.", spec: "PS 10, 11B · UI 5.13", phase: 2, mockups: ["POCreator.png"] },
  { key: "home-budget", title: "Home budget", route: "/projects/[id]/home-budget", shell: "project", usedBy: "Designers", does: "Whole-home budget including what the client buys directly; plan vs selected by category; contingency kept out of the forecast.", spec: "PS 11A · UI 5.9", phase: 3, mockups: ["HomeBudget.png"] },
  { key: "client-purchases", title: "Client purchases", route: "/projects/[id]/home-budget/purchases", shell: "project", usedBy: "Designers", does: "Timeline of client-bought items against Barebase milestones, dependencies and overdue decisions.", spec: "PS 11A · UI 5.10", phase: 3, mockups: ["ClientPurchases.png"] },

  // ---- Site work
  { key: "milestones", title: "Gantt chart", route: "/projects/[id]/milestones", shell: "project", usedBy: "Design lead, Site", does: "Milestones and sub-tasks as bars, status legend, planned vs forecast finish, next milestone, overdue tasks, client billing per milestone.", spec: "PS 13", phase: 3, mockups: ["Milestones.png"] },
  { key: "dpr", title: "Daily reports (DPR)", route: "/projects/[id]/milestones/dpr", shell: "project", usedBy: "Design lead, Site", does: "Month stats (filed, photos, crew, blockers) and a timeline of reports with weather, crew, materials and blockers raised.", spec: "PS 13", phase: 3, mockups: ["DPR.png"] },
  { key: "progress", title: "Progress by BOQ line", route: "/projects/[id]/milestones/progress", shell: "project", usedBy: "Design lead, Site", does: "Value-weighted progress, planned by today, each BOQ line with actual vs planned, status and last DPR.", spec: "PS 13", phase: 3, mockups: ["BOQProgress.png"] },
  { key: "site-dpr", title: "Daily report", route: "/site/[projectId]/dpr", shell: "site", usedBy: "Site supervisor", does: "Progress added by itself, photos, work done, crew steppers prefilled from yesterday, blockers; Submit report.", spec: "PS 13 · UI 5.7", phase: 3, mockups: ["PhoneDPR.png"] },
  { key: "snags", title: "Snags", route: "/projects/[id]/snags", shell: "project", usedBy: "Design lead, Site", does: "Open, fixed-to-verify and closed; severity, assignee, fix-by. A snag closes only with an after photo and the lead designer's check.", spec: "PS 14", phase: 3, mockups: ["Snags.png"] },
  { key: "site-snag", title: "Raise a snag", route: "/site/[projectId]/snag/new", shell: "site", usedBy: "Site supervisor", does: "Photo with circle mark-up, room, what's wrong, who fixes it, due date, severity.", spec: "PS 14", phase: 3, mockups: ["PhoneSnag.png"] },
  { key: "handover", title: "Handover", route: "/projects/[id]/handover", shell: "project", usedBy: "Design lead", does: "Snags closed, JMR signed, final proforma sent, vendor bills settled, warranties uploaded, walk-through booked; then the handover pack goes to the client portal and the warranty clock starts.", spec: "PS 14", phase: 3, mockups: ["Handover.png"] },
  { key: "history", title: "History", route: "/projects/[id]/history", shell: "project", usedBy: "Project team", does: "Every change on this project: who, when, before and after, with a Client badge on client actions. In India time. Until it's built, the audit log and its PDF export are on BOQ › Versions & Approvals.", spec: "PS 2, 18 · UI 3", phase: 1, mockups: ["ProjectOverview.png"], partOf: "Project menu" },

  // ---- Company finance
  { key: "finance", title: "Finance", route: "/finance", shell: "app", usedBy: "Admin, COO, Finance", does: "Cash in and out, owed to team, client dues overdue, monthly bars, claims list.", spec: "PS 11", phase: 2, mockups: ["OrgFinance.png"] },
  { key: "finance-billing", title: "Billing due", route: "/finance/billing", shell: "app", usedBy: "Finance", does: "Proformas drafted from milestones. Send proforma per row, preview, Edit before sending, Send all ready, Create now. Nothing goes out without a person pressing Send.", spec: "PS 11B · UI 5.15", phase: 2, mockups: ["BillingDue.png"] },
  { key: "finance-sent", title: "Sent & due", route: "/finance/sent", shell: "app", usedBy: "Finance, Design lead", does: "Every proforma, PO and BOQ sent: status, due, flag (overdue, due soon, on track, closed) and one follow-up button per row.", spec: "PS 11B · UI 5.14", phase: 2, mockups: ["SentTracker.png"] },
  { key: "finance-claims", title: "My claims", route: "/finance/claims", shell: "app", usedBy: "Everyone", does: "New claim and your own claims with status. Approved claims are paid on Friday.", spec: "PS 11", phase: 2, mockups: ["MyClaims.png"] },
  { key: "finance-claim-new", title: "New expense", route: "/finance/claims/new", shell: "app", usedBy: "Everyone", does: "Photograph the receipt, then amount, project, what for and paid from. Routed to the approver by slab. Designed for a phone.", spec: "PS 11, 12", phase: 2, mockups: ["PhoneClaim.png"] },
  { key: "finance-reimbursements", title: "Pending reimbursements", route: "/finance/reimbursements", shell: "app", usedBy: "Finance", does: "Approved claims to pay: select, Mark paid and download the bank file; people are notified and ledger entries written.", spec: "PS 11", phase: 2, mockups: ["Reimbursements.png"] },
  { key: "finance-transactions", title: "All transactions", route: "/finance/transactions", shell: "app", usedBy: "Finance, Admin", does: "One ledger of every rupee in and out, created only by the action that caused it; reversing entries for corrections; Tally CSV export.", spec: "PS 11, 17", phase: 2, mockups: ["Transactions.png"] },
  { key: "finance-tax", title: "GST and TDS", route: "/finance/tax", shell: "app", usedBy: "Finance", does: "Output GST, input credit, net to pay, TDS; returns calendar; problems to fix before filing. Exports for the CA.", spec: "PS 11, 19", phase: 2, mockups: ["GstTds.png"] },

  // ---- Admin
  { key: "team", title: "Team", route: "/team", shell: "app", usedBy: "Admin", does: "People, role, projects, load, active or invited; what each role can do; Invite person.", spec: "PS 4, 18, 21", phase: 0, mockups: ["Team.png"], live: "BOQ Studio's Team page: add, promote or demote, reset a password, deactivate and restore" },
  { key: "settings", title: "Org Settings", route: "/settings", shell: "app", usedBy: "Admin", does: "Company and letterhead · Roles and permissions · Approval slabs · Billing and numbering · Rate card.", spec: "PS 12, 18, 23", phase: 0, mockups: ["OrgSettings.png"], live: "Organisation and letterhead settings" },
  { key: "rate-card", title: "Rate card", route: "/settings/rate-card", shell: "app", usedBy: "Admin, Design lead", does: "Items with selling rate and cost price (locked for roles without cost), margin, low-margin filter, import from Excel. Changing a rate never changes a BOQ already sent.", spec: "PS 7", phase: 1, mockups: ["Catalogue.png"], live: "BOQ Studio's rate card: edit in place, CSV export and import with a preview" },

  // ---- Client portal
  { key: "client-progress", title: "Progress", route: "/c/[token]/progress", shell: "client", usedBy: "Client", does: "Overall progress, today's report with photos, payment due, Raise an issue.", spec: "PS 16 · UI 5.7", phase: 4, mockups: ["ClientPortal.png"] },
  { key: "client-budget", title: "Budget", route: "/c/[token]/budget", shell: "client", usedBy: "Client", does: "Whole-home forecast against the kick-off plan, \"We need from you\", a card per category. No cost, margin or vendor data.", spec: "PS 11A · UI 5.11", phase: 3, mockups: ["reference/11-client-portal-budget.png"], partOf: "Client portal" },
  { key: "client-estimate", title: "Estimate", route: "/c/[token]", shell: "client", usedBy: "Client", does: "Total, changes since the last version, rooms, ask a question on any line, Approve.", spec: "PS 8, 16", phase: 4, mockups: ["ClientBOQ.png"], live: "The client's estimate at /c/[token]: email check, line-by-line approve, reject, request change, notes" },
  { key: "client-payments", title: "Payments", route: "/c/[token]/payments", shell: "client", usedBy: "Client", does: "Payment schedule, what is due and what is received.", spec: "PS 16", phase: 4, mockups: ["ClientPortal.png"], partOf: "Client portal" },
  { key: "client-documents", title: "Docs", route: "/c/[token]/documents", shell: "client", usedBy: "Client", does: "Files marked Shared with client.", spec: "PS 16", phase: 4, mockups: ["ClientPortal.png"], partOf: "Client portal" },
  { key: "client-snags", title: "Snags", route: "/c/[token]/snags", shell: "client", usedBy: "Client", does: "The client's snags and ours, with status; raise a new one.", spec: "PS 16", phase: 4, mockups: ["ClientPortal.png"], partOf: "Client portal" },
  { key: "client-handover", title: "Handover", route: "/c/[token]/handover", shell: "client", usedBy: "Client", does: "Checklist status, handover pack download and sign-off.", spec: "PS 14, 16", phase: 4, mockups: ["ClientPortal.png"], partOf: "Client portal" },
  { key: "client-pay", title: "Pay a proforma", route: "/c/[token]/pay/[proformaId]", shell: "client", usedBy: "Client", does: "Balance due, bank and UPI details, the proforma PDF, and \"I've paid · add reference\", which Finance confirms in Client payments.", spec: "PS 11B, 16", phase: 4, mockups: ["ClientPay.png"] },
] as const satisfies readonly Screen[];

export type ScreenKey = (typeof SCREENS)[number]["key"];

export function screen(key: ScreenKey): Screen {
  const found = SCREENS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown screen: ${key}`);
  return found;
}

/** A route pattern filled in with sample values, for links and the navigation test. */
export function sampleHref(route: string, projectId = "villa-prakruthi"): string {
  return route
    .replace("[id]", projectId)
    .replace("[projectId]", projectId)
    .replace("[token]", "sample-client-link")
    .replace("[proformaId]", "PI-26-0044");
}
