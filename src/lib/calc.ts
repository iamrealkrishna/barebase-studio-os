/**
 * Every calculation on money, quantities and progress: BOQ lines and totals,
 * GST, discount, margin, TDS, progress, project finance and the home budget
 * (product spec section 19, 11A and 11B).
 *
 * Shared by the server and the browser so every screen, PDF and server action
 * shows the same number. Money is exact decimals, never JS floats; each formula
 * lands here with its unit tests in Phase 0 (see docs/PLAN.md).
 */

export {};
