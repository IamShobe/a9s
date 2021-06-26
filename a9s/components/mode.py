import math
from enum import Enum
from colored import fg, bg

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
    KeyMode.Navigation: bg("light_blue"),
    KeyMode.Search: bg("green"),
    KeyMode.Command: bg("light_red"),
    KeyMode.Debug: bg("yellow"),
}


class Mode(Renderer):
    def __init__(self):
        super(Mode, self).__init__()
        self.mode = KeyMode.Navigation

    def draw(self):
        style = Style(fg=fg("white"), bg=mode_to_color[self.mode])
        to_print = String(mode_to_str[self.mode]).with_style(style)
        spaces = (self.width - len(mode_to_str[self.mode]))
        left_side_spaces = String(math.floor(spaces / 2) * " ").with_style(style)
        right_side_spaces = String(math.ceil(spaces / 2) * " ").with_style(style)
        self.echo(left_side_spaces + to_print + right_side_spaces)
