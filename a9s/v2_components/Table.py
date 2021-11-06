import itertools
import logging
import math
from typing import List

import pyperclip
from rich.console import Console, ConsoleOptions, RenderResult, RenderableType
from rich.padding import Padding
from rich.text import Text, Segment
from textual import events
from textual.reactive import Reactive

from a9s.components.table import ColSettings
# from a9s.v2_components import List
from a9s.v2_components.List import ListWidget, PrintableList

# create logger with 'spam_application'
logger = logging.getLogger('app')
logger.setLevel(logging.DEBUG)
# create file handler which logs even debug messages
fh = logging.FileHandler('app.log')
fh.setLevel(logging.DEBUG)
# create console handler with a higher log level
# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
fh.setFormatter(formatter)
# add the handlers to the logger
logger.addHandler(fh)


class PrintableTable(PrintableList):
    def __init__(self, headers, data, offset=0, selected_row=None, displayed_data_start=0,
                 displayed_data_end=0, yank_mode=False, filter_str='') -> None:
        self.headers = headers
        self.data = data
        super(PrintableTable, self).__init__(self.data)
        self.offset = offset
        self.displayed_data_start = displayed_data_start
        self.displayed_data_end = displayed_data_end
        self.selected_row = selected_row
        self._filter = filter_str
        self.yank_mode = yank_mode

    def _get_printable_line(self, line: str, options: ConsoleOptions, filler=" "):
        width = options.max_width
        return line[self.offset:self.offset + width] + filler * (width - len(line))

    def _trim_row(self, row, options: ConsoleOptions, with_elipsis=False):
        actual_start = self.offset
        prefix = ""
        if self.offset > 0:
            prefix = "<- " if with_elipsis else "   "
            actual_start = len(prefix) + self.offset

        actual_end = self.offset + options.max_width
        suffix = ""
        if len(row) - self.offset > options.max_width:
            suffix = " ->" if with_elipsis else "   "
            actual_end = actual_end - len(suffix)

        return Text(prefix) + row[actual_start:actual_end] + Text(suffix)

    def __rich_console__(
            self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        header_style = "bold grey89 on dodger_blue2"
        row_to_print = Text("", style=header_style)
        # self._enrich_reponsive_headers()

        for header in self.headers:
            padding = Text(" " * header.padding, style=header_style)
            row_to_print += padding
            row_to_print += header.format_data(header.name.upper(), yank_mode=self.yank_mode)
            row_to_print += padding

        # row_to_print.style = header_style
        # self.max_offset = len(row_to_print) - self.width
        row_to_print = self._trim_row(row_to_print, options, with_elipsis=True)
        yield row_to_print

        for i, data_row in enumerate(self.data[self.displayed_data_start:self.displayed_data_end]):
            actual_i = self.displayed_data_start + i
            row_style = "reset"
            if self.selected_row == actual_i:
                row_style = "black on grey89"

            row_to_print = Text("", style=row_style)
            for header, data in zip(self.headers, data_row):
                padding = " " * header.padding
                row_to_print += Text(padding, style=row_style)
                row_to_print += header.format_data(data, self._filter, row_style=row_style)
                row_to_print += Text(padding, style=row_style)

            row_to_print = self._trim_row(row_to_print, options)
            yield row_to_print

        # data_len = len(self.data) + 1  # +1 for header length
        # if data_len < options.max_height:
        #     fill_lines = options.max_height - data_len
        #     for _ in range(fill_lines):
        #         yield Text(" ")


class TableWidget(ListWidget):
    headers: Reactive[List[ColSettings]] = Reactive([])
    data = Reactive([])

    transposed_data = Reactive([])

    @property
    def displayed_data_end(self):
        return self.size.height + self.displayed_data_start - 1  # we decrease the header size (1)

    def on_resize(self, event: events.Resize) -> None:
        self._enrich_responsive_headers()
        super(TableWidget, self).on_resize(event)

    def watch_data(self, data: list):
        self.transposed_data = list(map(list, itertools.zip_longest(*data, fillvalue=None)))
        for header, col in zip(self.headers, self.transposed_data):
            header.enrich_props_using_data(col)
        self._enrich_responsive_headers()
        super(TableWidget, self).watch_data(data)

    @property
    def filtered_data(self):
        logger = logging.getLogger('app')
        logger.info(f'reached here with {self.filter}')
        if len(self.filter) == 0:
            return self.data

        to_ret = []
        for data_row in self.data:
            found = False
            for col in data_row:
                if self.filter and self.filter in col:
                    found = True
                    break

            if found:
                to_ret.append(data_row)

        return to_ret

    async def handle_key(self, key):
        should_stop_propagate = await super().handle_key(key)
        if not should_stop_propagate and self.yank_mode:
            for header in self.headers:
                if key == header.yank_key:
                    pyperclip.copy(self.currently_selected_data[header.name])
                    self.yank_mode = False
                    should_stop_propagate = True

        return should_stop_propagate or self.data_updating

    def _calc_max_offset(self):
        if len(self.headers) > 0:
            return sum([header.get_full_size() for header in self.headers]) - self.size.width

        return 0

    def _enrich_responsive_headers(self):
        stretched_headers = []
        stretched_size = self.size.width
        stretched_padding = 0
        for header in self.headers:
            if header.stretched:
                stretched_padding += header.padding * 2
                stretched_headers.append(header)
                continue
            stretched_size -= header.get_full_size()

        stretched_size -= stretched_padding
        stretched_size = math.ceil(stretched_size / (len(stretched_headers) or 1))
        for header in stretched_headers:
            if header.user_defined_max_size and stretched_size > header._max_size:
                continue

            if header.user_defined_min_size and stretched_size < header._min_size:
                continue

            header.actual_size = stretched_size
        return stretched_size

    def get_row_representation(self, data):
        to_ret = {}
        for col, d in zip(self.headers, data):
            to_ret[col.name] = d

        return to_ret

    def render(self) -> RenderableType:
        return PrintableTable(
            headers=self.headers,
            data=self.displayed_data,
            filter_str=self.filter,
            offset=self.offset,
            selected_row=self.selected_row,
            displayed_data_start=self.displayed_data_start,
            displayed_data_end=self.displayed_data_end,
            yank_mode=self.yank_mode,
        )
