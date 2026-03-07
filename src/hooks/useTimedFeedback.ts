import { useState, useCallback, useEffect, useRef } from "react";

/** Manage a self-clearing feedback message with a configurable display duration. */
export function useTimedFeedback(defaultDuration = 1500) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearFeedback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFeedback(null);
  }, []);

  const pushFeedback = useCallback(
    (message: string, durationMs = defaultDuration) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setFeedback(message);
      timerRef.current = setTimeout(() => {
        setFeedback(null);
        timerRef.current = null;
      }, durationMs);
    },
    [defaultDuration],
  );

  return { feedback, pushFeedback, clearFeedback };
}
