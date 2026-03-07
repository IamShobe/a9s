/** Create `canGoBack` and `goBack` helpers for adapters that use a level + back-stack pattern. */
export function createBackStackHelpers<Level, Frame extends { level: Level }>(
  getLevel: () => Level,
  setLevel: (l: Level) => void,
  getBackStack: () => Frame[],
  setBackStack: (s: Frame[]) => void,
): { canGoBack: () => boolean; goBack: () => void } {
  const canGoBack = (): boolean => getBackStack().length > 0;

  const goBack = (): void => {
    const backStack = getBackStack();
    if (backStack.length > 0) {
      const newStack = backStack.slice(0, -1);
      const frame = backStack[backStack.length - 1]!;
      setBackStack(newStack);
      setLevel(frame.level);
    }
  };

  return { canGoBack, goBack };
}
