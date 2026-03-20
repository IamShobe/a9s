import { useAtomValue } from "jotai";
import { type AdapterStackFrame } from "../state/atoms.js";
import { createStackState } from "../utils/createStackState.js";

type AdapterNavFrame = { level: AdapterStackFrame | null };

const adapterStack = createStackState<AdapterStackFrame | null, AdapterNavFrame>(null);

const push = (frame: AdapterStackFrame): void => {
  const cur = adapterStack.getLevel();
  adapterStack.setBackStack([...adapterStack.getBackStack(), { level: cur }]);
  adapterStack.setLevel(frame);
};

const pop = (): AdapterStackFrame | undefined => {
  const current = adapterStack.getLevel();
  adapterStack.goBack();
  return current ?? undefined;
};

/** Seed the stack with a root frame before React renders. Call once at startup. */
export function seedAdapterRoot(root: AdapterStackFrame): void {
  adapterStack.setBackStack([{ level: root }]);
}

export function useAdapterStack() {
  const level     = useAtomValue(adapterStack.levelAtom);
  const backStack = useAtomValue(adapterStack.backStackAtom);

  const stack = [
    ...backStack.map((f) => f.level).filter((l): l is AdapterStackFrame => l !== null),
    ...(level ? [level] : []),
  ];

  return {
    stack,
    push,
    pop,
    clear: adapterStack.reset,
    isEmpty: stack.length === 0,
  };
}
