import math
from rich.containers import Lines
from rich.spinner import Spinner
from textual.messages import Update
from typing import Union

import pydash
from colored.colored import bg, fg, attr
from rich.align import Align
from rich.console import ConsoleOptions, RenderResult, RenderableType, Console
from rich.layout import Layout
from rich.text import Text
from textual.reactive import Reactive
from textual.widget import Widget

from a9s.components.custom_string import String, Style


class HUDComponent:
    SERVICE_NAME = None
    HUD_PROPS = None

    def get_hud_text(self):
        return Text(" ")


class PrintableHUD:
    SERVICE_SPACE = 10

    def __init__(self, service_name, service_style, text, spinner, is_loading):
        self.service_name = service_name
        self.service_style = service_style
        self.text = text
        self.spinner = spinner
        self.is_loading = is_loading

    def __rich_console__(
            self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        layout = Layout()
        panels = [
            Layout(Text(self.service_name, style=self.service_style, justify='center'), size=self.SERVICE_SPACE),
            Layout(self.text or Text(" ")),
        ]
        if self.is_loading:
            panels.append(Layout(self.spinner, size=1))
        layout.split_row(
            *panels
        )
        yield layout


class HUD(Widget):
    service_name = Reactive("")
    service_style = Reactive("")
    text = Reactive("")
    is_loading = Reactive(False)

    def __init__(self):
        super(HUD, self).__init__()
        # self.animate('text',)
        self.spinner = Spinner('dots2', style='green')

    async def force_update(self):
        if self.is_loading:
            await self.emit(Update(self, self))

    def render(self) -> RenderableType:
        return PrintableHUD(service_name=self.service_name, service_style=self.service_style, text=self.text,
                            spinner=self.spinner, is_loading=self.is_loading)

    # def draw(self):
    #     style = Style(fg=fg(pydash.get(self.service.HUD_PROPS, 'colors.fg', 'white')) + attr('bold'),
    #                   bg=bg(pydash.get(self.service.HUD_PROPS, 'colors.bg', 'blue')))
    #     to_print = String(self.service.SERVICE_NAME).with_style(style)
    #     spaces = (self.SERVICE_SPACE - len(self.service.SERVICE_NAME))
    #     left_side_spaces = String(math.floor(spaces / 2) * " ").with_style(style)
    #     right_side_spaces = String(math.ceil(spaces / 2) * " ").with_style(style)
    #     self.echo(left_side_spaces + to_print + right_side_spaces, no_new_line=True)
    #     service_text = self.service.get_hud_text()
    #     self.echo(service_text, x=self.x + self.SERVICE_SPACE, no_new_line=True)
    #
    #     text_len = len(service_text)
    #
    #     self.echo(String(" " * (self.width - self.SERVICE_SPACE - text_len)),
    #               x=self.x + self.SERVICE_SPACE + text_len)
