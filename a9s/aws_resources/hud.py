import math
from typing import Union

import pydash
from colored.colored import bg, fg, attr

from a9s.components.renderer import Renderer
from a9s.components.custom_string import String, Style


class HUDComponent:
    SERVICE_NAME = None
    HUD_PROPS = None

    def get_hud_text(self, space_left):
        return String("")


class HUD(Renderer):
    SERVICE_SPACE = 10

    def __init__(self):
        super().__init__()
        self.service: Union[HUDComponent, None] = None
    
    def draw(self):
        style = Style(fg=fg(pydash.get(self.service.HUD_PROPS, 'colors.fg', 'white')) + attr('bold'),
                      bg=bg(pydash.get(self.service.HUD_PROPS, 'colors.bg', 'blue')))
        to_print = String(self.service.SERVICE_NAME).with_style(style)
        spaces = (self.SERVICE_SPACE - len(self.service.SERVICE_NAME))
        left_side_spaces = String(math.floor(spaces / 2) * " ").with_style(style)
        right_side_spaces = String(math.ceil(spaces / 2) * " ").with_style(style)
        self.echo(left_side_spaces + to_print + right_side_spaces, no_new_line=True)
        service_text = self.service.get_hud_text(self.width - self.SERVICE_SPACE)
        self.echo(service_text, x=self.x + self.SERVICE_SPACE, no_new_line=True)

        text_len = len(service_text)

        self.echo(String(" " * (self.width - self.SERVICE_SPACE - text_len)),
                  x=self.x + self.SERVICE_SPACE + text_len)
