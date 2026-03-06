import { useCallback } from "react";
import { useAtom } from "jotai";
import { hierarchyStateAtom } from "../state/atoms.js";

export function useHierarchyState() {
  const [state, setState] = useAtom(hierarchyStateAtom);

  const reset = useCallback(() => {
    setState({ filters: [""], indices: [0] });
  }, [setState]);

  const updateCurrentFilter = useCallback(
    (value: string) => {
      setState((prev) => {
        const nextFilters =
          prev.filters.length === 0 ? [value] : [...prev.filters.slice(0, -1), value];
        return { ...prev, filters: nextFilters };
      });
    },
    [setState],
  );

  const pushLevel = useCallback(
    (selectedIndex: number, nextFilter = "") => {
      setState((prev) => ({
        filters: [...prev.filters, nextFilter],
        indices: [...prev.indices, selectedIndex],
      }));
    },
    [setState],
  );

  const popLevel = useCallback(() => {
    const nextFilters = state.filters.length > 1 ? state.filters.slice(0, -1) : state.filters;
    const nextIndices = state.indices.length > 1 ? state.indices.slice(0, -1) : state.indices;
    const restoredIndex =
      state.indices.length > 1
        ? (state.indices[state.indices.length - 1] ?? 0)
        : (state.indices[0] ?? 0);
    const restoredFilter = nextFilters[nextFilters.length - 1] ?? "";

    setState({ filters: nextFilters, indices: nextIndices });
    return { restoredFilter, restoredIndex };
  }, [setState, state.filters, state.indices]);

  return {
    filters: state.filters,
    indices: state.indices,
    reset,
    updateCurrentFilter,
    pushLevel,
    popLevel,
  };
}
