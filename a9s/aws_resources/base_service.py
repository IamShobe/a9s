import os

import boto3
from cached_property import cached_property

from a9s.aws_resources.hud import HUDComponent
from a9s.components.table import Table


IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'


class BaseService(Table, HUDComponent):
    BOTO_SERVICE = None

    @cached_property
    def cloudwatch_client(self):
        return boto3.client(service_name='cloudwatch', endpoint_url='http://localhost:54321' if IS_LOCAL else None)

    @cached_property
    def client(self):
        return boto3.client(service_name=self.BOTO_SERVICE, endpoint_url='http://localhost:54321' if IS_LOCAL else None)
