import os

from a9s.aws_resources.base_service import BaseService
from a9s.aws_resources.utils import pop_if_exists
from a9s.components.keys import BACK_KEYS, is_match
from a9s.components.logger import logger
from a9s.components.table import ColSettings, updates_table_data_method

IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'

YANK_KEYS = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'


class DynamoDBTable(BaseService):
    SERVICE_NAME = 'DynamoDB'
    BOTO_SERVICE = 'dynamodb'
    HUD_PROPS = {
        'colors': {
            'bg': 'blue'
        }
    }

    def __init__(self) -> None:
        self.table = None
        self._selection_stack = []
        self._filter_stack = []

        super().__init__([], [])

    def initialize(self):
        self.queue_thread_action(self.list_tables, self.on_updated_data)

    def on_select(self, data):
        if not self.table:
            self._filter_stack.append(self.filter)
            self._selection_stack.append(self.selected_row)
            logger.debug(f'Pushing {self.filter} and {self.selected_row} to stack')
            self.table = data
            self.queue_thread_action(self.list_table, self.on_updated_data)

    def handle_key(self, key):
        should_stop_propagate = super().handle_key(key)
        if is_match(key, BACK_KEYS) and not should_stop_propagate:
            if self.filter:
                return should_stop_propagate

            if self.table is not None:
                filter_str = pop_if_exists(self._filter_stack, default='')
                selected_row = pop_if_exists(self._selection_stack, default=0)
                logger.debug(f'Popped {filter_str} and {selected_row} from stack')
                self.queue_thread_action(self.list_tables, self.on_updated_data, filter_str=filter_str, selected_row=selected_row)
                self.table = None
                should_stop_propagate = True

        return should_stop_propagate

    @updates_table_data_method
    def list_table(self):
        response = self.client.describe_table(TableName=self.table['Name'])
        indexes = set()
        for key in response['Table']['KeySchema']:
            indexes.add(key['AttributeName'])

        headers = {}

        response = self.client.scan(TableName=self.table['Name'])
        data = []
        items = []
        for raw_item in response['Items']:
            item = {}
            for field_name, field_value in raw_item.items():
                headers[field_name] = ColSettings(field_name, stretched=True, min_size=30)
                for value in field_value.values():
                    item[field_name] = str(value)
                    break

            items.append(item)

        all_headers = sorted(headers.values(), key=lambda header: header.name in indexes, reverse=True)

        for index, header in enumerate(all_headers):
            if index < len(YANK_KEYS):
                header.yank_key = YANK_KEYS[index]

        for item in items:
            data.append([item.get(header.name, '') for header in all_headers])

        for header in all_headers:
            if header.name in indexes:
                header.name = f'{header.name} [i]'

        return all_headers, data

    @updates_table_data_method
    def list_tables(self):
        response = self.client.list_tables()
        headers = [ColSettings("Name", yank_key='n', stretched=True, min_size=20)]

        data = []
        for item in response['TableNames']:
            data.append([item])

        return headers, data
