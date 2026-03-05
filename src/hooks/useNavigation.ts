import { useState, useCallback } from 'react';

interface NavState {
  selectedIndex: number;
  scrollOffset: number;
}

export function useNavigation(rowCount: number, maxVisible: number) {
  const [state, setState] = useState<NavState>({ selectedIndex: 0, scrollOffset: 0 });

  const moveUp = useCallback(() => {
    setState((prev) => {
      const next = Math.max(0, prev.selectedIndex - 1);
      const off = next < prev.scrollOffset ? next : prev.scrollOffset;
      return { selectedIndex: next, scrollOffset: off };
    });
  }, []);

  const moveDown = useCallback(() => {
    setState((prev) => {
      const next = Math.min(Math.max(0, rowCount - 1), prev.selectedIndex + 1);
      const off = next >= prev.scrollOffset + maxVisible ? next - maxVisible + 1 : prev.scrollOffset;
      return { selectedIndex: next, scrollOffset: off };
    });
  }, [rowCount, maxVisible]);

  const reset = useCallback(() => {
    setState({ selectedIndex: 0, scrollOffset: 0 });
  }, []);

  const clampedIndex = Math.min(state.selectedIndex, Math.max(0, rowCount - 1));
  return { selectedIndex: clampedIndex, scrollOffset: state.scrollOffset, moveUp, moveDown, reset };
}
