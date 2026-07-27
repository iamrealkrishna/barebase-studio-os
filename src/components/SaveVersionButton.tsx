"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { saveVersion } from "@/actions/projects";
import { Toast, useToast } from "@/components/Toast";

export default function SaveVersionButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { message, toast } = useToast();
  const [pending, startTransition] = useTransition();

  const save = (status: "DRAFT" | "SENT_TO_CLIENT") => {
    startTransition(async () => {
      const result = await saveVersion(projectId, status);
      if (!result.ok) {
        toast(result.error ?? "Could not save that version");
        return;
      }
      toast(`Saved V${result.number}`);
      router.refresh();
    });
  };

  return (
    <>
      <button className="btn primary small" disabled={pending} onClick={() => save("DRAFT")}>
        {pending ? "Saving…" : "Save current state as new version"}
      </button>
      <button className="btn light small" disabled={pending} onClick={() => save("SENT_TO_CLIENT")}>
        Save &amp; mark Sent to Client
      </button>
      <Toast message={message} />
    </>
  );
}
