import type { ServiceAdapter } from '../../adapters/ServiceAdapter.js';
import type { ColumnDef, TableRow, SelectResult } from '../../types.js';

export class Route53ServiceAdapter implements ServiceAdapter {
  id = 'route53';
  label = 'Route53';
  hudColor = { bg: 'blue', fg: 'white' };

  getColumns(): ColumnDef[] {
    return [{ key: 'name', label: 'Name' }];
  }

  async getRows(): Promise<TableRow[]> {
    return [{ id: 'stub', cells: { name: 'Route53 not yet implemented' }, meta: {} }];
  }

  async onSelect(_row: TableRow): Promise<SelectResult> {
    return { action: 'none' };
  }

  canGoBack(): boolean {
    return false;
  }

  goBack(): void {}

  getPath(): string {
    return '/';
  }

  getContextLabel(): string {
    return '🌐 DNS Records';
  }
}
