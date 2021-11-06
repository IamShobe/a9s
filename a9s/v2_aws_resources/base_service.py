import os

import boto3
import pydash
from cached_property import cached_property

from a9s.v2_components.Table import TableWidget
from a9s.v2_components.hud import HUDComponent, HUD

IS_LOCAL = os.environ.get('LOCAL', 'false').lower() == 'true'


class BaseService(TableWidget, HUDComponent):
    BOTO_SERVICE = None

    def __init__(self, hud: HUD):
        self.hud = hud
        super(BaseService, self).__init__()

    async def initialize(self):
        await super(BaseService, self).initialize()
        self.hud.service_name = self.SERVICE_NAME
        self.hud.service_style = pydash.get(self.HUD_PROPS, "style", "white")
        self.hud.text = self.get_hud_text()

    @cached_property
    def cloudwatch_client(self):
        return boto3.client(service_name='cloudwatch', endpoint_url='http://localhost:54321' if IS_LOCAL else None)

    @cached_property
    def client(self):
        return boto3.client(service_name=self.BOTO_SERVICE, endpoint_url='http://localhost:54321' if IS_LOCAL else None)
