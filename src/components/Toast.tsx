"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The design's single bottom-centre toast — one message at a time, 2.4s. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2400);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { message, toast };
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div id="toast" className={message ? "show" : ""} role="status" aria-live="polite">
      {message}
    </div>
  );
}
