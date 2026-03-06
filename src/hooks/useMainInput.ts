import { useEffect } from "react";
import { useInput } from "ink";
import type { InputDispatcher } from "./inputEvents.js";

export function useMainInput(dispatch: InputDispatcher) {
  useEffect(() => {
    const handle = (data: Buffer) => {
      if (data.toString() === "\x03") {
        dispatch({ scope: "system", type: "ctrl-c" });
      }
    };
    process.stdin.on("data", handle);
    return () => {
      process.stdin.off("data", handle);
    };
  }, [dispatch]);

  useInput((input, key) => {
    dispatch({ scope: "raw", type: "key", input, key });
  }, { isActive: true });
}
