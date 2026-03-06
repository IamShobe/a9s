import { useState, useCallback, useEffect } from "react";

interface YankFeedback {
  message: string;
  timer: NodeJS.Timeout;
}

export function useYankMode() {
  const [yankMode, setYankMode] = useState(false);
  const [yankFeedback, setYankFeedback] = useState<YankFeedback | null>(null);

  useEffect(() => {
    return () => {
      if (yankFeedback?.timer) clearTimeout(yankFeedback.timer);
    };
  }, [yankFeedback]);

  const pushYankFeedback = useCallback(
    (message: string, durationMs = 1500) => {
      const timer = setTimeout(() => setYankFeedback(null), durationMs);
      setYankFeedback({ message, timer });
    },
    [],
  );

  const clearYankFeedback = useCallback(() => setYankFeedback(null), []);

  return {
    yankMode,
    setYankMode,
    yankFeedback,
    setYankFeedback,
    pushYankFeedback,
    clearYankFeedback,
  };
}
