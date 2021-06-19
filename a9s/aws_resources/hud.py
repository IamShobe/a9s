import math
from typing import Callable

from colored.colored import bg, fg

from attrdict import AttrDict

from a9s.components.renderer import Renderer
from a9s.components.custom_string import String, Style


services = {
    'S3': {
        'colors': {
            'bg': 'red',
        }
    },
    'Route 53': {
        'colors': {
            'bg': 'orange_1'
        }
    }
}

class HUDComponent:
    SERVICE_NAME = None

    def get_hud_text(self, space_left):
        return String("")


class HUD(Renderer):
    SERVICE_SPACE = 10
    def __init__(self):
        super().__init__()
        self.service = None
    
    @property
    def service_props(self):
        return AttrDict(services[self.service.SERVICE_NAME])

    def draw(self, echo_func: Callable):
        style = Style(fg=fg(self.service_props.colors.get('fg', 'white')), bg=bg(self.service_props.colors.bg))
        to_print = String(self.service.SERVICE_NAME).with_style(style)
        spaces = (self.SERVICE_SPACE - len(self.service.SERVICE_NAME))
        left_side_spaces = String(math.floor(spaces / 2) * " ").with_style(style)
        right_side_spaces = String(math.ceil(spaces / 2) * " ").with_style(style)
        echo_func(self.x, self.y, left_side_spaces + to_print + right_side_spaces)
        service_text = self.service.get_hud_text(self.width - self.SERVICE_SPACE)
        echo_func(self.x + self.SERVICE_SPACE, self.y, service_text)

        text_len = len(service_text)

        echo_func(self.x + self.SERVICE_SPACE + text_len, self.y, String(" " * (self.width - self.SERVICE_SPACE - text_len)))
