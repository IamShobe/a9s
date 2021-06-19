from typing import Union

from a9s.aws_resources.route53 import Route53Table
from a9s.aws_resources.s3 import S3Table
from a9s.components.renderer import Renderer
from a9s.components.table import Table


class ServicesSelector(Renderer):
    def __init__(self, hud):
        super(ServicesSelector, self).__init__()
        self.services = {
            'route53': Route53Table,
            's3': S3Table,
        }

        self.hud = hud
        self.current_service = 'route53'

    def set_pos(self, *, x, y, to_x, to_y=None):
        if self._current_service:
            self._current_service.set_pos(x=x, y=y, to_x=to_x, to_y=to_y)

        super(ServicesSelector, self).set_pos(x=x, y=y, to_x=to_x, to_y=to_y)

    @property
    def current_service(self) -> Union[None, Table]:
        return self._current_service

    @current_service.setter
    def current_service(self, service):
        if service not in self.services:
            raise ValueError('Invalid service requested - {}!'.format(service))

        self._current_service = self.services[service]()
        self._current_service.set_pos(x=self.x, y=self.y, to_x=self.to_x, to_y=self.to_y)
        self.hud.service = self._current_service

    def set_service(self, service):
        self.current_service = service

    def handle_key(self, key):
        if self.current_service:
            self.current_service.handle_key(key)

    def onresize(self):
        if self.current_service:
            self.current_service.onresize()

    def draw(self, echo):
        if not self.current_service:
            return super(ServicesSelector, self).draw(echo)

        return self.current_service.draw(echo)
