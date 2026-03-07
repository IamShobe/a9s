import { useState } from "react";
import { useTimedFeedback } from "./useTimedFeedback.js";

export function useYankMode() {
  const [yankMode, setYankMode] = useState(false);
  const { feedback, pushFeedback: pushYankFeedback, clearFeedback: clearYankFeedback } = useTimedFeedback(1500);

  // Expose feedback in the same shape callers might expect
  const yankFeedback = feedback ? { message: feedback } : null;

  return {
    yankMode,
    setYankMode,
    yankFeedback,
    pushYankFeedback,
    clearYankFeedback,
  };
}
