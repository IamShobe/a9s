import os
from subprocess import call
import pathlib

import curses
import tempfile
import boto3
from colored.colored import bg, fg

from .hud import HUDComponent
from a9s.components.custom_string import String
from a9s.components.table import ColSettings, Table


IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'
EDITOR = os.environ.get('EDITOR', 'vim')


class S3Table(Table, HUDComponent):
    SERVICE_NAME = 'S3'

    def __init__(self) -> None:
        self.client = boto3.client(service_name='s3', endpoint_url='http://localhost:4566' if IS_LOCAL else None)
        self.bucket = None
        self.paths = []
        self._selection_stack = []
        self._filter_stack = []

        headers, data = self.list_buckets()
        super().__init__(headers, data)

    def get_hud_text(self, space_left):
        if not self.bucket:
            return super().get_hud_text(space_left)

        return String([String(self.bucket, bg=bg('orange_1'), fg=fg('black')).reset_style_on_end(),
                        String("/"), String(self.prefix[-(space_left - len(self.bucket) - 1):])])
    
    @property
    def prefix(self):
        return "".join(self.paths)

    def handle_key(self, key):
        should_stop = super().handle_key(key)
        if key.code == curses.KEY_EXIT and not should_stop:
            if self.filter:
                return should_stop

            if len(self.paths) > 0:
                self.paths.pop()
                self.headers, self.data = self.list_bucket()
                should_stop = True

            elif self.bucket is not None:
                self.headers, self.data = self.list_buckets()
                self.bucket = None
                should_stop = True
        
            if len(self._filter_stack) > 0 or len(self._selection_stack) > 0:
                self.filter = self._filter_stack.pop()
                self.selected_row = self._selection_stack.pop()

        return should_stop
 
    def on_select(self, data):
        if not self.bucket:
            self._filter_stack.append(self.filter)
            self._selection_stack.append(self.selected_row)
            self.bucket = data['Bucket name']
            self.headers, self.data = self.list_bucket()
        
        else:
            if data['Type'] == "folder":
                self._filter_stack.append(self.filter)
                self._selection_stack.append(self.selected_row)
                self.paths.append(data['Key'])
                self.headers, self.data = self.list_bucket()
            
            else:  # we are a file
                full_key = self.prefix + data['Key']
                resp = self.client.get_object(Bucket=self.bucket, Key=full_key)
                with tempfile.NamedTemporaryFile(suffix="." + full_key.replace("/", "___")) as tf:
                    for chunk in resp['Body'].iter_chunks():
                        tf.write(chunk)

                    tf.flush()
                    call([EDITOR, tf.name])

    def list_buckets(self):
        response = self.client.list_buckets()
        headers = [ColSettings("Bucket name", stretched=True, yank_key='n'), ColSettings("Creation date", yank_key='d')]
        data = []
        for bucket in response['Buckets']:
            data.append([bucket['Name'], str(bucket['CreationDate'])])

        return headers, data

    def list_bucket(self):
        objects = self.client.list_objects_v2(Bucket=self.bucket, Delimiter="/", Prefix=self.prefix)
        headers = [ColSettings("Key", stretched=True, min_size=15, yank_key='k'), ColSettings("Type"), ColSettings("Last modify"), ColSettings("ETag", yank_key='t'), ColSettings("Size"), ColSettings("Storage Class"), ColSettings("Owner")]
        data = []
        for object in objects.get('CommonPrefixes', []):
            folder_data = [String(str(object['Prefix'].replace(self.prefix, "", 1)), fg=fg('magenta_3c')), "folder"]
            folder_data += (len(headers) - len(folder_data)) * [""]
            data.append(folder_data)

        for object in objects.get('Contents', []):
            name = object['Key'].replace(self.prefix, "", 1)
            file_type =  "file ({})".format(pathlib.Path(name).suffix) if pathlib.Path(name).suffix else "file"
            data.append([name, file_type, str(object['LastModified']), object['ETag'], str(object['Size']), object['StorageClass'], object.get('Owner', {}).get('DisplayName', "")])

        return headers, data
