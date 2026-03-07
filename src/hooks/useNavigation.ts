import { useState, useCallback } from "react";

function clampIndex(index: number, rowCount: number): number {
  return Math.max(0, Math.min(Math.max(0, rowCount - 1), index));
}

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
      const off =
        next >= prev.scrollOffset + maxVisible ? next - maxVisible + 1 : prev.scrollOffset;
      return { selectedIndex: next, scrollOffset: off };
    });
  }, [rowCount, maxVisible]);

  const reset = useCallback(() => {
    setState({ selectedIndex: 0, scrollOffset: 0 });
  }, []);

  const setIndex = useCallback(
    (index: number) => {
      setState(() => {
        const next = clampIndex(index, rowCount);
        const off = Math.max(0, next - Math.max(0, maxVisible - 1));
        return { selectedIndex: next, scrollOffset: off };
      });
    },
    [rowCount, maxVisible],
  );

  const toTop = useCallback(() => {
    setState({ selectedIndex: 0, scrollOffset: 0 });
  }, []);

  const toBottom = useCallback(() => {
    const lastIndex = Math.max(0, rowCount - 1);
    const bottomOffset = Math.max(0, rowCount - maxVisible);
    setState({ selectedIndex: lastIndex, scrollOffset: bottomOffset });
  }, [rowCount, maxVisible]);

  const clampedIndex = clampIndex(state.selectedIndex, rowCount);
  return {
    selectedIndex: clampedIndex,
    scrollOffset: state.scrollOffset,
    moveUp,
    moveDown,
    reset,
    setIndex,
    toTop,
    toBottom,
  };
}
