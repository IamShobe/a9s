import type { ServiceAdapter } from '../../adapters/ServiceAdapter.js';
import type { ColumnDef, TableRow, SelectResult } from '../../types.js';

export class DynamoDBServiceAdapter implements ServiceAdapter {
  id = 'dynamodb';
  label = 'DynamoDB';
  hudColor = { bg: 'green', fg: 'white' };

  getColumns(): ColumnDef[] {
    return [{ key: 'name', label: 'Name' }];
  }

  async getRows(): Promise<TableRow[]> {
    return [{ id: 'stub', cells: { name: 'DynamoDB not yet implemented' }, meta: {} }];
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
    return '⚡ Tables';
  }
}
