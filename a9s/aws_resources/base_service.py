import os

import boto3
from cached_property import cached_property

from a9s.aws_resources.hud import HUDComponent
from tepy.components.table import Table


IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'
ENDPOINT_URL = os.environ.get('AWS_ENDPOINT', 'http://localhost:54321')


class BaseService(Table, HUDComponent):
    BOTO_SERVICE = None

    def __init__(self):
        super().__init__([], [])

    @cached_property
    def cloudwatch_client(self):
        return boto3.client(service_name='cloudwatch', endpoint_url=ENDPOINT_URL if IS_LOCAL else None)

    @cached_property
    def client(self):
        return boto3.client(service_name=self.BOTO_SERVICE, endpoint_url=ENDPOINT_URL if IS_LOCAL else None)
