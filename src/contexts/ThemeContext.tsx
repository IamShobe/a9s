import React, { createContext, useContext } from "react";
import { useAtomValue } from "jotai";
import { THEMES } from "../constants/theme.js";
import type { ThemeTokens } from "../constants/theme.js";
import { themeNameAtom } from "../state/atoms.js";

const ThemeContext = createContext<ThemeTokens>(THEMES.monokai);

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeName = useAtomValue(themeNameAtom);
  return <ThemeContext.Provider value={THEMES[themeName]}>{children}</ThemeContext.Provider>;
}
