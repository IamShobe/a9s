import os

import curses
import boto3
from colored.colored import fg

from components.custom_string import String
from components.table import ColSettings, Table


IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'


class S3Table(Table):
    def __init__(self) -> None:
        super().__init__([], []) 
        self.client = boto3.client(service_name='s3', endpoint_url='http://localhost:4566' if IS_LOCAL else None)
        self.bucket = None
        self.paths = []

        self.headers, self.data = self.list_buckets()
    
    @property
    def prefix(self):
        return "".join(self.paths)

    def handle_key(self, key):
        super().handle_key(key)
        if key.code == curses.KEY_EXIT:
            if len(self.paths) > 0:
                self.paths.pop()
                self.headers, self.data = self.list_bucket()

            else:
                self.headers, self.data = self.list_buckets()
                self.bucket = None
 
    def on_select(self, data):
        if not self.bucket:
            self.bucket = data['Bucket name']
            self.headers, self.data = self.list_bucket()
            self.filter = ""
        
        else:
            if data['Type'] == "folder":
                self.paths.append(data['Key'])
                self.headers, self.data = self.list_bucket()
                self.filter = ""

    def list_buckets(self):
        response = self.client.list_buckets()
        headers = [ColSettings("Bucket name", stretched=True), ColSettings("Creation date")]
        data = []
        for bucket in response['Buckets']:
            data.append([bucket['Name'], str(bucket['CreationDate'])])

        return headers, data

    def list_bucket(self):
        objects = self.client.list_objects(Bucket=self.bucket, Delimiter="/", Prefix=self.prefix)
        headers = [ColSettings("Key", stretched=True, min_size=15), ColSettings("Type"), ColSettings("Last modify"), ColSettings("ETag"), ColSettings("Size"), ColSettings("Storage Class"), ColSettings("Owner")]
        data = []
        for object in objects.get('CommonPrefixes', []):
            folder_data = [String(str(object['Prefix'].replace(self.prefix, "", 1)), fg=fg('magenta_3c')), "folder"]
            folder_data += (len(headers) - len(folder_data)) * [""]
            data.append(folder_data)

        for object in objects.get('Contents', []):
            data.append([object['Key'].replace(self.prefix, "", 1), "file", str(object['LastModified']), object['ETag'], str(object['Size']), object['StorageClass'], object['Owner']['DisplayName']])

        return headers, data
    