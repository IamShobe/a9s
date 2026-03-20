import { atom, getDefaultStore, type Atom } from "jotai";

export function createStackState<
  Level,
  Frame extends { level: Level }
>(initialLevel: Level) {
  const store         = getDefaultStore();
  const levelAtom     = atom<Level>(initialLevel);
  const backStackAtom = atom<Frame[]>([]);
  const uiBackStackAtom = atom<{ filterText: string; selectedIndex: number }[]>([]);

  const getLevel     = (): Level         => store.get(levelAtom);
  const setLevel     = (l: Level): void  => store.set(levelAtom, l);
  const getBackStack = (): Frame[]        => store.get(backStackAtom);
  const setBackStack = (s: Frame[]): void => store.set(backStackAtom, s);

  const canGoBack = (): boolean => getBackStack().length > 0;

  const pushUiLevel = (filterText: string, selectedIndex: number): void => {
    const s = store.get(uiBackStackAtom);
    store.set(uiBackStackAtom, [...s, { filterText, selectedIndex }]);
  };

  const goBack = (): { filterText: string; selectedIndex: number } | undefined => {
    const s = getBackStack();
    if (!s.length) return undefined;
    const top = s[s.length - 1]!;
    setBackStack(s.slice(0, -1));
    setLevel(top.level);

    const ui = store.get(uiBackStackAtom);
    if (!ui.length) return undefined;
    const uiTop = ui[ui.length - 1]!;
    store.set(uiBackStackAtom, ui.slice(0, -1));
    return uiTop;
  };

  const reset = (): void => {
    setLevel(initialLevel);
    setBackStack([]);
    store.set(uiBackStackAtom, []);
  };

  return {
    getLevel, setLevel,
    getBackStack, setBackStack,
    canGoBack, goBack, pushUiLevel, reset,
    levelAtom:     levelAtom     as Atom<Level>,
    backStackAtom: backStackAtom as Atom<Frame[]>,
  };
}
