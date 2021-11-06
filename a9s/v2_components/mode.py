import math
from enum import Enum
from colored import fg, bg
from rich.console import RenderableType, Console, ConsoleOptions, RenderResult
from rich.text import Text
from textual.reactive import Reactive
from textual.widget import Widget

from a9s.components.custom_string import String, Style
from a9s.components.renderer import Renderer


class KeyMode(Enum):
    Navigation = 0
    Search = 1
    Command = 2
    Debug = 3


mode_to_str = {
    KeyMode.Navigation: "NAVIGATE",
    KeyMode.Search: "SEARCH",
    KeyMode.Command: "COMMAND",
    KeyMode.Debug: "D-NAV",
}

mode_to_color = {
    KeyMode.Navigation: "on steel_blue3",
    KeyMode.Search: "on green",
    KeyMode.Command: "on red1",
    KeyMode.Debug: "on yellow",
}


class ModeRender:
    def __init__(self, mode):
        self.mode = mode

    def __rich_console__(
            self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        yield Text(mode_to_str[self.mode], style=mode_to_color[self.mode], justify="center")


class Mode(Widget):
    mode = Reactive(KeyMode.Navigation)

    def render(self) -> RenderableType:
        return ModeRender(self.mode)
    #
    #
    # def draw(self):
    #     style = Style(fg=fg("white"), bg=mode_to_color[self.mode])
    #     to_print = String(mode_to_str[self.mode]).with_style(style)
    #     spaces = (self.width - len(mode_to_str[self.mode]))
    #     left_side_spaces = String(math.floor(spaces / 2) * " ").with_style(style)
    #     right_side_spaces = String(math.ceil(spaces / 2) * " ").with_style(style)
    #     self.echo(left_side_spaces + to_print + right_side_spaces)
