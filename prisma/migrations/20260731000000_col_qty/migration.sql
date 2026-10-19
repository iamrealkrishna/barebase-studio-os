-- The client-facing column toggle for "Unit" becomes "Qty": a unit with no
-- quantity beside it tells a client nothing, so one toggle now governs both.
-- Renamed rather than dropped and re-added so existing per-project choices
-- carry over instead of silently resetting to "on".

ALTER TABLE "Project" RENAME COLUMN "colUnit" TO "colQty";
