import asyncio

from typing import Union

from rich.console import RenderableType
from rich.layout import Layout
from rich.text import Text
from textual.reactive import Reactive
from textual.view import View
from textual.views import GridView
from textual.widget import Widget
from textual.widgets import Placeholder

from a9s.components.logger import logger
from a9s.v2_aws_resources.base_service import BaseService
from a9s.v2_aws_resources.route53 import Route53Table


class ServicesSelector(GridView):

    SERVICES = [Route53Table]

    # service = Reactive('route53')
    service = Reactive(None)

    def __init__(self, hud, on_filter_change=None):
        super(ServicesSelector, self).__init__(name="ServicesSelector")
        self.grid.add_row('row')
        self.grid.add_column('col')
        self.grid.add_areas(
            service='col,row',
        )
        self.grid.place(service=Placeholder())
        # self.grid.add_widget()
        self.hud = hud
        self._on_filter_change = on_filter_change
        self.services = {table.BOTO_SERVICE: table for table in self.SERVICES}
        # self.set_service('route53')
        # self.service = self.services['route53'](hud=hud, on_filter_change=on_filter_change)
        # self._current_service = None

    # async def initialize(self):
    #     if self.service:
    #         await self.service.initialize()

    # def set_pos(self, *, x, y, to_x, to_y=None):
    #     if self._current_service:
    #         self._current_service.set_pos(x=x, y=y, to_x=to_x, to_y=to_y)
    #
    #     super(ServicesSelector, self).set_pos(x=x, y=y, to_x=to_x, to_y=to_y)

    # @property
    # def current_service(self) -> Union[None, Table]:
    #     return self._current_service

    # @current_service.setter
    # def current_service(self, service):
    #     if service not in self.services:
    #         raise ValueError('Invalid service requested - {}!'.format(service))
    #
    #     self._current_service = self.services[service](hud=self.hud)
    #     self.service = service
        # self._current_service.initialize()

        # self.hud.service = self._current_service

    async def set_service(self, service):
        logger.debug(f'service is {service}')

        self.service: BaseService = self.services[service](hud=self.hud, on_filter_change=self._on_filter_change)
        await self.service.initialize()
        self.grid.place(service=self.service)
        await self.focus()
        self.refresh()

    # def handle_key(self, key):
    #     if self.current_service:
    #         self.current_service.handle_key(key)

    # async def update_data(self):
    #     to_await = [super(ServicesSelector, self).update_data()]
    #     if self.current_service:
    #         to_await.append(self.current_service.update_data())
    #
    #     await asyncio.gather(*to_await)

    # def render(self) -> RenderableType:
    #     return Layout(self.service)

        # return Placeholder()
