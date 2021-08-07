import os
import datetime
from subprocess import call
import pathlib

import tempfile
from colored.colored import bg, fg

from a9s.aws_resources.base_service import BaseService
from a9s.aws_resources.utils import pop_if_exists
from a9s.components.custom_string import String
from a9s.components.keys import BACK_KEYS, is_match
from a9s.components.logger import logger
from a9s.components.table import ColSettings, updates_table_data_method
from a9s.components.app import EDITOR

IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'


class S3Table(BaseService):
    SERVICE_NAME = 'S3'
    BOTO_SERVICE = 's3'
    HUD_PROPS = {
        'colors': {
            'bg': 'red'
        }
    }

    def __init__(self) -> None:
        self.bucket = None
        self.paths = []
        self._selection_stack = []
        self._filter_stack = []

        super().__init__([], [])

    def initialize(self):
        self.queue_thread_action(self.list_buckets, self.on_updated_data)

    def get_hud_text(self, space_left):
        if not self.bucket:
            return super().get_hud_text(space_left)

        return String([String(self.bucket, bg=bg('orange_1'), fg=fg('black')).reset_style_on_end(),
                       String("/"), String(self.prefix[-(space_left - len(self.bucket) - 1):])])

    @property
    def prefix(self):
        return "".join(self.paths)

    def handle_key(self, key):
        should_stop_propagate = super().handle_key(key)
        if is_match(key, BACK_KEYS) and not should_stop_propagate:
            filter_str = pop_if_exists(self._filter_stack, default='')
            selected_row = pop_if_exists(self._selection_stack, default=0)
            logger.debug(f'Popped {filter_str} and {selected_row} from stack')

            if len(self.paths) > 0:
                self.paths.pop()
                self.queue_thread_action(self.list_bucket, self.on_updated_data, filter_str=filter_str, selected_row=selected_row)
                should_stop_propagate = True

            elif self.bucket is not None:
                self.queue_thread_action(self.list_buckets, self.on_updated_data, filter_str=filter_str, selected_row=selected_row)
                self.bucket = None
                should_stop_propagate = True

        return should_stop_propagate

    def on_select(self, data):
        if not self.bucket:
            logger.debug(f'Pushing {self.filter} and {self.selected_row} to stack')
            self._filter_stack.append(self.filter)
            self._selection_stack.append(self.selected_row)
            self.bucket = data['Bucket name']
            self.queue_thread_action(self.list_bucket, self.on_updated_data)

        else:
            if data['Type'] == "folder":
                logger.debug(f'Pushing {self.filter} and {self.selected_row} to stack')
                self._filter_stack.append(self.filter)
                self._selection_stack.append(self.selected_row)
                self.paths.append(data['Key'])
                self.queue_thread_action(self.list_bucket, self.on_updated_data)

            else:  # we are a file
                self.queue_blocking_action(self.download_file, data)

    def download_file(self, data):
        full_key = self.prefix + data['Key']
        resp = self.client.get_object(Bucket=self.bucket, Key=full_key)
        with tempfile.NamedTemporaryFile(suffix="." + full_key.replace("/", "___")) as tf:
            for chunk in resp['Body'].iter_chunks():
                tf.write(chunk)

            tf.flush()
            call([EDITOR, tf.name])

    def storage_amount(self):
        metrics = self.cloudwatch_client.get_metric_statistics(Namespace='AWS/S3', MetricName='BucketSizeBytes', Period=86400,
                                                               StartTime=datetime.datetime.now() - datetime.timedelta(1),
                                                               EndTime=datetime.datetime.now(), Statistics=['Average'],
                                                               Dimensions=[{'Name': 'BucketName', 'Value': self.bucket},
                                                                           {'Value': 'StandardStorage', 'Name': 'StorageType'}]
                                                               )
        if len(metrics['Datapoints']) > 0:
            return metrics['Datapoints'][0]['Average']

        return 0

    @updates_table_data_method
    def list_buckets(self):
        response = self.client.list_buckets()
        headers = [ColSettings("Bucket name", stretched=True, yank_key='n'), ColSettings("Creation date", yank_key='d')]
        data = []
        for bucket in response['Buckets']:
            data.append([bucket['Name'], str(bucket['CreationDate'])])

        return headers, data

    @updates_table_data_method
    def list_bucket(self):
        objects = self.client.list_objects_v2(Bucket=self.bucket, Delimiter="/", Prefix=self.prefix)
        headers = [ColSettings("Key", stretched=True, min_size=15, yank_key='k'), ColSettings("Type"), ColSettings("Last modify"),
                   ColSettings("ETag", yank_key='t'), ColSettings("Size"), ColSettings("Storage Class"), ColSettings("Owner")]
        data = []
        for object in objects.get('CommonPrefixes', []):
            folder_data = [String(str(object['Prefix'].replace(self.prefix, "", 1)), fg=fg('magenta_3c')), "folder"]
            folder_data += (len(headers) - len(folder_data)) * [""]
            data.append(folder_data)

        for object in objects.get('Contents', []):
            name = object['Key'].replace(self.prefix, "", 1)
            file_type = "file ({})".format(pathlib.Path(name).suffix) if pathlib.Path(name).suffix else "file"
            data.append([name, file_type, str(object['LastModified']), object['ETag'], str(object['Size']), object['StorageClass'],
                         object.get('Owner', {}).get('DisplayName', "")])

        return headers, data
