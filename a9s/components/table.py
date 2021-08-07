import itertools

import math
import pyperclip
from copy import copy
from dataclasses import dataclass, field
from typing import Union, Callable, List

from colored import fg, bg, attr

from a9s.components.renderer import ScrollableRenderer
from a9s.components.custom_string import String, Style


@dataclass
class ColSettings:
    name: str
    maxWidth: int = None
    stretched: bool = False
    padding: int = 3
    min_size: Union[int, Callable[[int, "ColSettings"], int]] = None
    max_size: Union[int, Callable[[int, "ColSettings"], int]] = None
    no_shrink: bool = False
    yank_key: str = None

    data_max_len: int = field(init=False, default=0)
    actual_size: int = field(init=False, default=0)
    _min_size: int = 0
    _max_size: int = 0

    def __post_init__(self):
        self.user_defined_min_size = self.min_size is not None
        self.user_defined_max_size = self.max_size is not None

    def enrich_props_using_data(self, col):
        max_data_size = max(len(value) if value else 0 for value in col)
        self.data_max_len = max_data_size

        self._min_size = max(min(len(self.name), max_data_size), 3)
        if self.min_size:
            if callable(self.min_size):
                val = self.min_size(max_data_size, self)

            else:
                val = self.min_size

            self._min_size = max(val, self._min_size)

        self._max_size = max(max_data_size, len(self.name), self._min_size)
        if self.max_size:
            if callable(self.max_size):
                val = self.max_size(max_data_size, self)

            else:
                val = self.max_size

            self._max_size = max(min(val, self._max_size), self._min_size)

        self.actual_size = self._max_size

    def get_full_size(self):
        return self.actual_size + self.padding * 2

    def format_substr(self, data, search, match_style, row_style):
        if len(search) == 0:
            return data

        fragments = data.split(search, 1)
        to_append = String(search, fg=match_style).force_self_style()
        return to_append.join(fragments)

    def format_data(self, data, search="", row_style=attr("reset"), match_style=fg("blue"), yank_mode=False):
        if isinstance(data, str):
            data = String(data)
        
        data = copy(data)

        used_max_size = self.actual_size
        match_index = -1
        if len(search) > 0:
            match_index = data.find(search)

        to_ret = data
        if match_index != -1:
            to_ret = self.format_substr(data, search, match_style, row_style)
        if len(data) > self.actual_size:
            if self.actual_size > self._min_size:
                to_ret = to_ret[:self.actual_size - 3]
                if match_index > self.actual_size - 3 or (match_index != -1 and len(search) > self.actual_size - 3):
                    to_ret += String("...", fg=match_style)
                else:
                    to_ret += "..."

            else:
                if len(data) > self._min_size:
                    to_ret = to_ret[:self._min_size - 3]
                    if match_index > self._min_size - 3 or (match_index != -1 and len(search) > self._min_size - 3):
                        to_ret += String("...", fg=match_style)
                    else:
                        to_ret += "..."
                else:
                    to_ret = to_ret[:self._min_size]

                used_max_size = self._min_size


        if yank_mode and self.yank_key:
            to_ret += String("({})".format(self.yank_key))
    
        data_len = len(to_ret)
        if used_max_size - data_len > 0:
            to_ret += " " * (used_max_size - data_len)

        return to_ret


class Table(ScrollableRenderer):
    def __init__(self, headers: List[ColSettings], data):
        super(Table, self).__init__(data)
        self._transposed_data = []

        self.headers = headers
        self.data = data
        self.data_updating = True
    
    def _on_select(self, data):
        if not self.data_updating:
            super(Table, self)._on_select(data)

    def on_updated_data(self, data, filter_str='', selected_row=0):
        self.headers, self.data = data
        self.filter = filter_str
        self.selected_row = selected_row
        self.data_updating = False

    def on_data_set(self, new_value):
        self._transposed_data = list(map(list, itertools.zip_longest(*new_value, fillvalue=None)))
        self.selected_row = 0
        self.offset = 0
        self._displayed_data_start = 0
        for header, col in zip(self.headers, self._transposed_data):
            header.enrich_props_using_data(col)
    
    def handle_key(self, key):
        should_stop_propagate = super(Table, self).handle_key(key)
        if not should_stop_propagate and self.yank_mode:
            for header in self.headers:
                if key == header.yank_key:
                    pyperclip.copy(self.currently_selected_data[header.name])
                    self.yank_mode = False
                    should_stop_propagate = True

        return should_stop_propagate or self.data_updating

    def _enrich_reponsive_headers(self):
        stretched_headers = []
        stretched_size = self.width
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

    @property
    def filtered_data(self):
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

    def get_row_representation(self, data):
        to_ret = {}
        for col, d in zip(self.headers, data):
            if isinstance(d, String):
                d = repr(d)
            to_ret[col.name] = d

        return to_ret

    def draw(self):
        header_style = Style(fg=fg("light_gray") + attr('bold'), bg=bg("dodger_blue_2"))
        row_to_print = String("").with_style(header_style)
        self._enrich_reponsive_headers()

        for header in self.headers:
            padding = " " * header.padding
            row_to_print += String(padding).with_style(header_style)
            row_to_print += header.format_data(header.name.upper(), yank_mode=self.yank_mode)
            row_to_print += String(padding).with_style(header_style)

        self.max_offset = len(row_to_print) - self.width
        row_to_print = self._trim_row(row_to_print, with_elipsis=True)
        self.echo(row_to_print)

        for i, data_row in enumerate(self.displayed_data[self.displayed_data_start:self.displayed_data_end]):
            actual_i = self.displayed_data_start + i
            row_style = Style()
            if self.selected_row == actual_i:
                row_style = Style(fg=fg("black"), bg=bg("light_gray"))

            row_to_print = String("").with_style(row_style)
            for header, data in zip(self.headers, data_row):
                padding = " " * header.padding
                row_to_print += String(padding).with_style(row_style)
                row_to_print += header.format_data(data, self._filter)
                row_to_print += String(padding).with_style(row_style)

            row_to_print = self._trim_row(row_to_print)
            self.echo(row_to_print)


def updates_table_data_method(f):
    def inner(self, *args, **kwargs):
        self.data_updating = True
        return f(self, *args, **kwargs)

    return inner
