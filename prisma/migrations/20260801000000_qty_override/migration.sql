-- Lets a dimension-driven line carry a typed quantity instead of L×B, for
-- oddly-shaped areas where the team already knows the total.

ALTER TABLE "LineItem" ADD COLUMN "qtyOverride" BOOLEAN NOT NULL DEFAULT false;
