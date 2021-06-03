from typing import Callable

from colored import attr

from .custom_string import String
from .renderer import Renderer


class AutoComplete(Renderer):
    def __init__(self):
        super(AutoComplete, self).__init__()
        self._index = 0
        self._buffer = [" "] * self.width
        self.text = ""

    def get_printed_text(self):
        buffer = [" "] * self.width
        for i, char in enumerate(self.text[-len(buffer):]):
            buffer[i] = char

        return "".join(buffer)

    def delete_char(self):
        if len(self.text) > 1:
            self.text = self.text[:-1]

    def get_actual_text(self):
        return self.text[1:]

    def draw(self, echo_func: Callable):
        echo_func(self.x, self.y, String(self.get_printed_text(), fg=attr("reset")))
