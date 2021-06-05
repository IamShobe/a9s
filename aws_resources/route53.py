from aws_resources.hud import HUDComponent
import os
from subprocess import call
import pathlib

import curses
import tempfile
import boto3
from colored.colored import bg, fg

from components.custom_string import String
from components.table import ColSettings, Table


IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'
EDITOR = os.environ.get('EDITOR', 'vim')


class Route53Table(Table, HUDComponent):
    SERVICE_NAME = 'Route 53'

    def __init__(self) -> None:
        super().__init__([], [])
        self.client = boto3.client(service_name='route53', endpoint_url='http://localhost:4566' if IS_LOCAL else None)
        self.hosted_zone = None
        self._selection_stack = []
        self._filter_stack = []

        self.headers, self.data = self.list_hosted_zones()

    def handle_key(self, key):
        should_stop = super().handle_key(key)
        if key.code == curses.KEY_EXIT and not should_stop:
            if self.filter:
                return should_stop

            if self.hosted_zone is not None:
                self.headers, self.data = self.list_hosted_zones()
                self.hosted_zone = None
                should_stop = True

            if len(self._filter_stack) > 0 or len(self._selection_stack) > 0:
                self.filter = self._filter_stack.pop()
                self.selected_row = self._selection_stack.pop()

        return should_stop

    def on_select(self, data):
        if not self.hosted_zone:
            self._filter_stack.append(self.filter)
            self._selection_stack.append(self.selected_row)
            self.hosted_zone = data['ID']
            self.headers, self.data = self.list_records()

    def list_hosted_zones(self):
        response = self.client.list_hosted_zones()
        headers = [ColSettings("Name", yank_key='k', stretched=True, min_size=20), ColSettings("ID", yank_key='i'), ColSettings("Records")]

        data = []
        for item in response['HostedZones']:
            data.append([item['Name'], item['Id'], str(item['ResourceRecordSetCount'])])

        return headers, data

    def list_records(self):
        headers = [ColSettings('Name', yank_key='k', min_size=20, stretched=True), ColSettings('Type'), ColSettings('TTL'), ColSettings('Record', yank_key='r')]
        data = []

        should_continue = True
        next_record_name = None
        while should_continue:
            if next_record_name is None:
                response = self.client.list_resource_record_sets(HostedZoneId=self.hosted_zone, MaxItems='300')
            else:
                response = self.client.list_resource_record_sets(HostedZoneId=self.hosted_zone, StartRecordName=next_record_name, MaxItems='300')

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
