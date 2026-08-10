-- When a client says they've finished reviewing. Their per-line verdicts save
-- on the click regardless; this only separates "not started" from "done".
ALTER TABLE "ClientContact" ADD COLUMN "reviewSubmittedAt" TIMESTAMP(3);
