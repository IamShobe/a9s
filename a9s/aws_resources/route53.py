from colored.colored import bg, fg

from a9s.aws_resources.base_service import BaseService
from a9s.aws_resources.utils import pop_if_exists
from a9s.components.custom_string import String
from a9s.components.keys import BACK_KEYS, is_match
from a9s.components.logger import logger
from a9s.components.table import ColSettings, updates_table_data_method


class Route53Table(BaseService):
    SERVICE_NAME = 'Route 53'
    BOTO_SERVICE = 'route53'
    HUD_PROPS = {
        'colors': {
            'bg': 'orange_1'
        }
    }

    def __init__(self) -> None:
        self.hosted_zone = None
        self._selection_stack = []
        self._filter_stack = []

        super().__init__([], [])

    def initialize(self):
        self.queue_thread_action(self.list_hosted_zones, self.on_updated_data)

    def get_hud_text(self, space_left):
        if not self.hosted_zone:
            return super().get_hud_text(space_left)

        return String(self.hosted_zone['Name'], bg=bg('medium_purple_2a'), fg=fg('black')).reset_style_on_end()

    def handle_key(self, key):
        should_stop_propagate = super().handle_key(key)
        if is_match(key, BACK_KEYS) and not should_stop_propagate:
            if self.filter:
                return should_stop_propagate

            if self.hosted_zone is not None:
                filter_str = pop_if_exists(self._filter_stack, default='')
                selected_row = pop_if_exists(self._selection_stack, default=0)
                logger.debug(f'Popped {filter_str} and {selected_row} from stack')
                self.queue_thread_action(self.list_hosted_zones, self.on_updated_data, filter_str=filter_str, selected_row=selected_row)
                self.hosted_zone = None
                should_stop_propagate = True

        return should_stop_propagate

    def on_select(self, data):
        if not self.hosted_zone:
            self._filter_stack.append(self.filter)
            self._selection_stack.append(self.selected_row)
            logger.debug(f'Pushing {self.filter} and {self.selected_row} to stack')
            self.hosted_zone = data
            self.queue_thread_action(self.list_records, self.on_updated_data)

    @updates_table_data_method
    def list_hosted_zones(self):
        response = self.client.list_hosted_zones()
        headers = [ColSettings("Name", yank_key='n', stretched=True, min_size=20), ColSettings("ID", yank_key='i'), ColSettings("Records")]

        data = []
        for item in response['HostedZones']:
            data.append([item['Name'], item['Id'], str(item['ResourceRecordSetCount'])])

        return headers, data

    @updates_table_data_method
    def list_records(self):
        headers = [ColSettings('Name', yank_key='n', min_size=20, stretched=True), ColSettings('Type'), ColSettings('TTL', yank_key='t'), ColSettings('Record', yank_key='r')]
        data = []

        should_continue = True
        next_record_name = None
        while should_continue:
            if next_record_name is None:
                response = self.client.list_resource_record_sets(HostedZoneId=self.hosted_zone['ID'], MaxItems='300')
            else:
                response = self.client.list_resource_record_sets(HostedZoneId=self.hosted_zone['ID'], StartRecordName=next_record_name, MaxItems='300')

            if not response['IsTruncated']:
                should_continue = False

            else:
                next_record_name = response['NextRecordName']

            for item in response['ResourceRecordSets']:
                record = item.get('AliasTarget', {}).get('DNSName')
                if not record and item.get('ResourceRecords'):
                    record = ', '.join(r['Value'] for r in item['ResourceRecords'])
                data.append([item['Name'], item['Type'], str(item.get('TTL', '')), record])

        return headers, data
