import logging

from typing import List

from cached_property import cached_property
from rich.align import Align
from rich.console import Console, ConsoleOptions, RenderResult, RenderableType
from rich.padding import Padding
from rich.text import Text, Segment
from rich.panel import Panel
from rich.table import Table
from textual import events

from textual.app import App
from textual.events import InputEvent, Key
from textual.geometry import Offset
from textual.reactive import Reactive
from textual.views import GridView
from textual.widget import Widget
from textual.widgets import Button, ButtonPressed, Placeholder, ScrollView, DirectoryTree
from pyfiglet import Figlet

from a9s.components.keys import RIGHT_KEYS, LEFT_KEYS, UP_KEYS, DOWN_KEYS, END_OF_LINE_KEYS, START_OF_LINE_KEYS, \
    START_OF_DOC_KEYS, END_OF_DOC_KEYS, is_match, ENTER_KEYS, COPY_KEYS, BACK_KEYS


class PrintableList:
    def __init__(self, data: List[str], offset=0, selected_row=None, displayed_data_start=0, displayed_data_end=0) -> None:
        self.data = data
        self.offset = offset
        self.displayed_data_start = displayed_data_start
        self.displayed_data_end = displayed_data_end
        self.selected_row = selected_row

    def _get_printable_line(self, line: str, options: ConsoleOptions, filler=" "):
        width = options.max_width
        return line[self.offset:self.offset + width] + filler * (width - len(line))

    def __rich_console__(
        self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        for i, line in enumerate(self.data[self.displayed_data_start:self.displayed_data_end]):
            actual_row_index = i + self.displayed_data_start
            style = 'black on rgb(200,200,200)' if actual_row_index == self.selected_row else ''
            yield Text(self._get_printable_line(line, options), style=style)


class ListWidget(Widget):
    data = Reactive([])
    offset = Reactive(0)
    selected_row = Reactive(0)
    filter = Reactive("")
    yank_mode = Reactive(False)

    displayed_data_start = Reactive(0)
    # max_offset = Reactive(0)

    def __init__(self):
        super(ListWidget, self).__init__()
        self._max_offset = self._calc_max_offset()
        self.data_updating = False

    def _calc_max_offset(self):
        if len(self.data) > 0:
            return max(max(len(line) for line in self.data) - self.size.width, 0)

        return 0

    def on_resize(self, event: events.Resize) -> None:
        super(ListWidget, self).on_resize(event)
        self._max_offset = self._calc_max_offset()

    @property
    def displayed_data_end(self):
        return self.size.height + self.displayed_data_start

    @property
    def filtered_data(self):
        if len(self.filter) == 0:
            return self.data

        to_ret = []
        for data_row in self.data:
            if self.filter and self.filter in data_row:
                to_ret.append(data_row)

        return to_ret

    @cached_property
    def displayed_data(self):
        return self.filtered_data

    def watch_filter(self, value: str):
        self.selected_row = 0
        self.offset = 0
        self.displayed_data_start = 0
        if 'displayed_data' in self.__dict__:
            del self.__dict__['displayed_data']

    def watch_data(self, data: list):
        self._max_offset = self._calc_max_offset()
        self.selected_row = 0
        self.offset = 0
        self.displayed_data_start = 0
        if 'displayed_data' in self.__dict__:
            del self.__dict__['displayed_data']

    def move_right(self):
        if self.offset < self._max_offset:
            self.offset += 1

    def move_left(self):
        if self.offset > 0:
            self.offset -= 1

    def prev_selection(self):
        if self.selected_row > 0:
            self.selected_row -= 1

            if self.selected_row < self.displayed_data_start:
                self.displayed_data_start -= 1

    def next_selection(self):
        if self.selected_row < len(self.displayed_data) - 1:
            self.selected_row += 1

            if self.selected_row > self.displayed_data_end - 1:
                self.displayed_data_start += 1

    def hscroll_end(self):
        self.offset = max(self._max_offset, 0)

    def hscroll_start(self):
        self.offset = 0

    def vscroll_start(self):
        self.displayed_data_start = 0
        self.selected_row = 0

    def vscroll_end(self):
        self.displayed_data_start = max(len(self.displayed_data) - self.size.height + 1, 0)
        self.selected_row = max(len(self.displayed_data) - 1, 0)

    def get_row_representation(self, data):
        return data

    @property
    def currently_selected_data(self):
        data = self.displayed_data[self.selected_row]
        return self.get_row_representation(data)

    async def _on_select(self, data):
        await self.on_select(data)

    async def on_select(self, data):
        pass

    # async def on_key(self, event: Key):
    #     await self.handle_key(event.key)

    async def handle_key(self, key: str):
        if is_match(key, RIGHT_KEYS):
            self.move_right()

        elif is_match(key, LEFT_KEYS):
            self.move_left()

        if is_match(key, UP_KEYS):
            self.prev_selection()

        elif is_match(key, DOWN_KEYS):
            self.next_selection()

        elif is_match(key, ENTER_KEYS):
            await self._on_select(self.currently_selected_data)

        elif is_match(key, BACK_KEYS):
            if self.yank_mode:
                self.yank_mode = False
                return True  # swallows the Exit key

            elif self.filter:
                self.filter = ''
                return True

        if is_match(key, END_OF_LINE_KEYS):
            self.hscroll_end()

        elif is_match(key, START_OF_LINE_KEYS):
            self.hscroll_start()

        elif is_match(key, START_OF_DOC_KEYS):
            self.vscroll_start()

        elif is_match(key, END_OF_DOC_KEYS):
            self.vscroll_end()

        elif is_match(key, COPY_KEYS):
            self.yank_mode = True

        return False

    async def initialize(self):
        pass

    def render(self) -> RenderableType:
        return Padding(
            PrintableList(
                self.displayed_data,
                offset=self.offset,
                selected_row=self.selected_row,
                displayed_data_start=self.displayed_data_start,
                displayed_data_end=self.displayed_data_end,
            ),
            (0, 1),
            style="white on rgb(51,51,51)",
        )


