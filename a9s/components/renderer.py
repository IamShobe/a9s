import curses
from cached_property import cached_property
from typing import Callable

from colored import attr

from .custom_string import String


class Renderer:
    hidden_cursor: bool = True

    def __init__(self):
        self.x = 0
        self.y = 0
        self.to_x = self.x + 1
        self.to_y = self.y

        # renderer row
        self._curr_row = 0

    @property
    def width(self):
        return self.to_x - self.x

    @property
    def height(self):
        return self.to_y - self.y

    def fill_empty(self, echo_func: Callable):
        filler = " " * self.width
        while self._curr_row < self.height:
            echo_func(self.x, self.y + self._curr_row, filler)
            self._curr_row += 1
        
        self._curr_row = 0

    def draw(self, echo_func: Callable):
        self.fill_empty(echo_func=echo_func)

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
    
    def on_select(self, data):
        pass

    def handle_key(self, key):
        if key.code == curses.KEY_RIGHT or key == "l":
            self.move_right()

        elif key.code == curses.KEY_LEFT or key == "h":
            self.move_left()

        if key.code == curses.KEY_UP or key == "k":
            self.prev_selection()

        elif key.code == curses.KEY_DOWN or key == "j":
            self.next_selection()
        
        elif key.code == curses.KEY_ENTER:
            data = self.displayed_data[self.selected_row]
            self.on_select(self.get_row_representation(data))
        
        elif key.code == curses.KEY_EXIT:
            if self.yank_mode:
                self.yank_mode = False
                return True  # swallows the Exit key

        if key == "$":
            self.hscroll_end()

        elif key == "0":
            self.hscroll_start()

        elif key == "g":
            self.vscroll_start()

        elif key == "G":
            self.vscroll_end()
        
        elif key == "y":
            self.yank_mode = True

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
    