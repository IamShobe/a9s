from typing import Callable

from colored import fg, bg

from .custom_string import Style
from .renderer import ScrollableRenderer

MAX_RECORDS = 100


class Logger(ScrollableRenderer):
    def __init__(self):
        super(Logger, self).__init__([])
        self._halt_debug = False
        self.shown = False

        self.halt_buffer = []

    def halt_debug(self):
        self._halt_debug = True

    def continue_debug(self):
        for msg in self.halt_buffer:
            self._add_message(msg)

        self.halt_buffer = []
        self._halt_debug = False

    def _add_message(self, msg: str):
        self.data = (self._data + [msg])[-MAX_RECORDS:]

    def on_data_set(self, new_value):
        self._displayed_data_start = max(len(self.displayed_data) - self.height + 1, 0)
        self.selected_row = len(self.displayed_data) - 1

    def debug(self, msg: str):
        if self._halt_debug:
            self.halt_buffer.append(msg)
            return

        self._add_message(msg)

    def draw(self, echo_func: Callable):
        if not self.shown:
            return
            
        self._curr_row = 0
        for i, log in enumerate(self.displayed_data[self.displayed_data_start:self.displayed_data_end]):
            actual_i = self.displayed_data_start + i
            row_style = Style()
            if self.selected_row == actual_i:
                row_style = Style(fg=fg("black"), bg=bg("light_gray"))

            log = log + " " * (self.width - len(log))
            echo_func(self.x, self.y + self._curr_row, self._trim_row(log).with_style(row_style))
            self._curr_row += 1
        
        super().draw(echo_func)


logger = Logger()
