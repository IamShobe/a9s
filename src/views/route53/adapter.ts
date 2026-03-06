import type { ServiceAdapter } from '../../adapters/ServiceAdapter.js';
import type { ColumnDef, TableRow, SelectResult } from '../../types.js';
import { textCell } from '../../types.js';

export function createRoute53ServiceAdapter(): ServiceAdapter {
  const getColumns = (): ColumnDef[] => [{ key: 'name', label: 'Name' }];

  const getRows = async (): Promise<TableRow[]> => {
    return [{ id: 'stub', cells: { name: textCell('Route53 not yet implemented') }, meta: {} }];
  };

  const onSelect = async (_row: TableRow): Promise<SelectResult> => {
    return { action: 'none' };
  };

  return {
    id: 'route53',
    label: 'Route53',
    hudColor: { bg: 'blue', fg: 'white' },
    getColumns,
    getRows,
    onSelect,
    canGoBack: () => false,
    goBack: () => {},
    getPath: () => '/',
    getContextLabel: () => '🌐 DNS Records',
  };
}
