import threading

import time

import asyncio

from cached_property import cached_property
from typing import Union

from colored import attr

from a9s.components.custom_string import String
from a9s.components.keys import RIGHT_KEYS, is_match, LEFT_KEYS, UP_KEYS, DOWN_KEYS, ENTER_KEYS, BACK_KEYS, END_OF_LINE_KEYS, START_OF_LINE_KEYS, \
    START_OF_DOC_KEYS, END_OF_DOC_KEYS, COPY_KEYS
from a9s.components.utils import FPS


class Renderer:
    hidden_cursor: bool = True

    def __init__(self):
        self.x = 0
        self.y = 0
        self.to_x = self.x + 1
        self.to_y = self.y

        # renderer row
        self._curr_row = 0
        self._curr_col = 0

        self._echo_func = None
        self._async_coroutines = {}
        self._pending_coroutines = []
        self._blocking_action = None
        self.force_empty_fill = False

        self._shown = True

    def initialize(self):
        pass

    @property
    def shown(self):
        return self._shown

    @shown.setter
    def shown(self, value):
        if value:
            self.show()

        else:
            self.hide()

    def hide(self):
        self.force_empty_fill = True
        self._shown = False

    def show(self):
        self._shown = True

    @property
    def width(self):
        return self.to_x - self.x

    @property
    def height(self):
        return self.to_y - self.y

    def fill_empty(self):
        try:
            if not self.shown and not self.force_empty_fill:
                return

            filler = String(" " * (self.width - self._curr_col), fg=attr('reset'))
            while self._curr_row < self.height:
                self.echo(filler)

        finally:
            self.set_relative_pos(0, 0)

    def set_relative_pos(self, x=None, y=None):
        if x is not None:
            self._curr_col = x

        if y is not None:
            self._curr_row = y

    def echo(self, string: Union[String, str], *, x=None, y=None, no_new_line=False):
        if not self._echo_func:
            raise RuntimeError('Echo func was not defined!')

        y_defined = y is not None
        y = self.y + self._curr_row if y is None else y

        x = self.x + self._curr_col if x is None else x
        self._echo_func(x, y, string)
        if not y_defined and not no_new_line:
            self._curr_row += 1

    async def update_data(self):
        if self._blocking_action:
            self._blocking_action['handler'](*self._blocking_action['args'], **self._blocking_action['kwargs'])
            self._blocking_action['event'].set()
            self._blocking_action = None

        captured_routines = self._pending_coroutines
        self._pending_coroutines = []
        for coroutine in captured_routines:
            task = asyncio.create_task(asyncio.to_thread(coroutine['routine']))
            self._async_coroutines[task] = coroutine

        coroutines = set(self._async_coroutines.keys())
        if len(coroutines) == 0:
            return

        done, pending = await asyncio.wait(coroutines, timeout=FPS)
        for routine in done:
            routine_describe = self._async_coroutines[routine]
            handler = routine_describe['handler']
            handler(routine.result(), *routine_describe['args'], **routine_describe['kwargs'])
            del self._async_coroutines[routine]

    def queue_thread_action(self, routine, callback, *args, **kwargs):
        self._pending_coroutines.append(dict(handler=callback, routine=routine, args=args, kwargs=kwargs))

    def queue_blocking_action(self, routine, *args, **kwargs):
        event = threading.Event()
        self._blocking_action = dict(handler=routine, args=args, kwargs=kwargs, event=event)
        event.wait()

    def draw(self):
        pass

    def render(self, echo_func):
        self._echo_func = echo_func
        if self.shown:
            self.draw()

        self.fill_empty()

    def set_pos(self, *, x, y, to_x, to_y=None):
        self.x = x
        self.y = y
        self.to_x = to_x
        self.to_y = to_y if to_y else y + 1

    def handle_key(self, key):
        pass

    def onresize(self):
        pass


class ScrollableRenderer(Renderer):
    def __init__(self, data):
        super(ScrollableRenderer, self).__init__()
        self._data = data
        self._displayed_data = self._data

        self.offset = 0
        self.max_offset = 0
        self.selected_row = 0
        self._displayed_data_start = 0

        self._filter = ""
        self.filter = ""
        self.yank_mode = False

        self.data_updating = False

    def onresize(self):
        self.offset = 0

    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, new_value):
        self._data = new_value
        self.filter = ""
        if 'displayed_data' in self.__dict__:
            del self.__dict__['displayed_data']
        self.on_data_set(new_value)

    def on_data_set(self, new_value):
        pass

    @cached_property
    def displayed_data(self):
        return self.filtered_data

    @property
    def filter(self):
        return self._filter

    @filter.setter
    def filter(self, value):
        if self._filter != value:
            self.selected_row = 0
            self._displayed_data_start = 0

        self._filter = value
        if 'displayed_data' in self.__dict__:
            del self.__dict__['displayed_data']

    @property
    def filtered_data(self):
        if len(self.filter) == 0:
            return self.data

        to_ret = []
        for data_row in self.data:
            if self.filter and self.filter in data_row:
                to_ret.append(data_row)

        return to_ret

    def hscroll_end(self):
        self.offset = max(self.max_offset, 0)

    def hscroll_start(self):
        self.offset = 0

    def vscroll_start(self):
        self._displayed_data_start = 0
        self.selected_row = 0

    def vscroll_end(self):
        self._displayed_data_start = max(len(self.displayed_data) - self.height + 1, 0)
        self.selected_row = len(self.displayed_data) - 1

    @property
    def displayed_data_start(self):
        return self._displayed_data_start

    @property
    def displayed_data_end(self):
        return self.height + self.displayed_data_start - 1

    def move_right(self):
        if self.offset < self.max_offset:
            self.offset += 1

    def move_left(self):
        if self.offset > 0:
            self.offset -= 1

    def prev_selection(self):
        if self.selected_row > 0:
            self.selected_row -= 1

            if self.selected_row < self.displayed_data_start:
                self._displayed_data_start -= 1

    def next_selection(self):
        if self.selected_row < len(self.displayed_data) - 1:
            self.selected_row += 1

            if self.selected_row > self.displayed_data_end - 1:
                self._displayed_data_start += 1

    def get_row_representation(self, data):
        if isinstance(data, String):
            data = repr(data)

        return data
    
    def _on_select(self, data):
        self.on_select(data)

    def on_select(self, data):
        pass

    @property
    def currently_selected_data(self):
        data = self.displayed_data[self.selected_row]
        return self.get_row_representation(data)

    def handle_key(self, key) -> bool:
        if is_match(key, RIGHT_KEYS):
            self.move_right()

        elif is_match(key, LEFT_KEYS):
            self.move_left()

        if is_match(key, UP_KEYS):
            self.prev_selection()

        elif is_match(key, DOWN_KEYS):
            self.next_selection()
        
        elif is_match(key, ENTER_KEYS):
            self._on_select(self.currently_selected_data)
        
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

    def _trim_row(self, row, with_elipsis=False):
        actual_start = self.offset
        prefix = ""
        if self.offset > 0:
            prefix = "<- " if with_elipsis else "   "
            actual_start = len(prefix) + self.offset

        actual_end = self.offset + self.width
        suffix = ""
        if len(row) - self.offset > self.width:
            suffix = " ->" if with_elipsis else "   "
            actual_end = actual_end - len(suffix)

        return String(prefix, fg=attr("reset")) + row[actual_start:actual_end] + String(suffix, fg=attr("reset"))
