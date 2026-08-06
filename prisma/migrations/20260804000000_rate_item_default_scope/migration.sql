-- Boilerplate scope of work per rate card item, copied onto a BOQ line when the
-- item is added. Existing items start blank, which behaves exactly as before.
ALTER TABLE "RateItem" ADD COLUMN "defaultScope" TEXT NOT NULL DEFAULT '';
