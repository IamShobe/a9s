import type { z } from "zod";
import type { TableRow, Cell } from "../../types.js";
import type { KeyTrigger } from "../../constants/keybindings.js";

/** TableRow with strongly-typed meta from adapter's Zod schema */
export interface ParsedRow<TMeta> {
  id: string;
  cells: Record<string, Cell>;
  meta: TMeta;
}

/** Per-option definition: generic over row meta type and adapter context */
export interface YankOptionDef<TMeta, TCtx extends object = Record<string, never>> {
  trigger: KeyTrigger;
  label: string;
  feedback: string;
  headerKey?: string;
  isRelevant(row: ParsedRow<TMeta>): boolean;
  resolve(row: ParsedRow<TMeta>, ctx: TCtx): Promise<string | null>;
}

/** Public interface — unchanged */
export interface YankOption {
  trigger: KeyTrigger;
  label: string;
  feedback: string;
  headerKey?: string;
  isRelevant(row: TableRow): boolean;
  resolve(row: TableRow): Promise<string | null>;
}

export interface YankCapability {
  getYankOptions(row: TableRow): YankOption[];
}

/**
 * Generic factory — the single implementation of getYankOptions.
 * Parses row.meta via schema, filters by isRelevant, wraps with typed resolve.
 */
export function createYankCapability<TMeta, TCtx extends object = Record<string, never>>(
  options: YankOptionDef<TMeta, TCtx>[],
  schema: z.ZodType<TMeta>,
  ctx: TCtx,
): YankCapability {
  const parse = (row: TableRow): ParsedRow<TMeta> | null => {
    const result = schema.safeParse(row.meta);
    if (!result.success) return null;
    return { id: row.id, cells: row.cells, meta: result.data };
  };

  return {
    getYankOptions(row: TableRow): YankOption[] {
      const typedRow = parse(row);
      if (!typedRow) return [];

      return options
        .filter((def) => def.isRelevant(typedRow))
        .map((def) => {
          const option: YankOption = {
            trigger: def.trigger,
            label: def.label,
            feedback: def.feedback,
            isRelevant: (r: TableRow): boolean => {
              const tr = parse(r);
              return tr !== null && def.isRelevant(tr);
            },
            resolve: (r: TableRow): Promise<string | null> => {
              const tr = parse(r);
              if (!tr) return Promise.resolve(null);
              return def.resolve(tr, ctx);
            },
          };
          if (def.headerKey !== undefined) {
            option.headerKey = def.headerKey;
          }
          return option;
        });
    },
  };
}
