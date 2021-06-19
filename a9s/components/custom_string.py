from dataclasses import dataclass
from typing import Union, List
from copy import copy
from itertools import chain

from colored import attr


@dataclass
class Char:
    c: str
    fg: str = None
    bg: str = None
    should_reset_style: bool = False

    def __copy__(self):
        return Char(self.c, self.fg, self.bg, should_reset_style=self.should_reset_style)

    def __len__(self):
        return len(self.c)

    def format(self):
        to_ret = (self.fg or "") + (self.bg or "") + self.c
        if self.should_reset_style:
            to_ret += attr("reset")

        return to_ret

    def __add__(self, other):
        if isinstance(other, Char):
            return String([self, other])

        if isinstance(other, str):
            return String([self, Char(c=other)])

    def __repr__(self):
        return self.c

    def __str__(self):
        return self.format()


@dataclass
class Style:
    fg: str = None
    bg: str = None


class String:
    def __init__(self, starting_string: Union[str, "String", Char, List[Union["String", Char]]],
                 fg=None, bg=None):
        self._chars = []
        self.chars = starting_string
        self.fg = fg
        self.bg = bg

    def __len__(self):
        return sum(len(c) for c in self._chars)

    def join(self, str_list):
        if len(str_list) == 0:
            return String("")

        if len(str_list) == 1:
            return copy(str_list[0])

        total = copy(str_list[0])
        for elem in str_list[1:]:
            total += copy(self)
            total += copy(elem)

        return total

    def pad(self, width, char=" "):
        to_pad = width - len(self)
        if to_pad > 0:
            self._chars.append(String(char * to_pad))

        return self

    def reset_style_on_end(self):
        if len(self._chars) == 0:
            return self

        last = self._chars[-1]
        if isinstance(last, String):
            return last.reset_style_on_end()

        elif isinstance(last, Char):
            last.should_reset_style = True

        return self

    def with_style(self, style: Style):
        self.fg = style.fg
        self.bg = style.bg

        return self

    def find(self, seed):
        curr_i = 0
        was_matched = False
        initial_find = -1
        for i, c in enumerate(self):
            if repr(c) == seed[curr_i]:
                if not was_matched:
                    initial_find = i
                    was_matched = True
                curr_i += 1

            else:
                initial_find = -1
                curr_i = 0
                was_matched = False

            if curr_i == len(seed):
                return initial_find

        return -1

    def split(self, seed, count):
        if len(seed) == 0:
            return [self]

        j = 0
        i = 0
        times_splitted = 0

        splitted_str = list(self)
        length = len(splitted_str)
        if len(seed) > length:
            return [self]

        current_fragment = []
        fragments = [current_fragment]
        was_matched = False
        fragment_appended = True
        while i + j < length:
            if repr(splitted_str[i + j]) == seed[j] and times_splitted < count:
                if not was_matched:
                    if not fragment_appended:
                        fragments.append(current_fragment)
                    was_matched = True
                    current_fragment = []
                    fragment_appended = False

                current_fragment.append(splitted_str[i + j])
                j += 1
                if j == len(seed):  # we got a full match dismiss current fragment
                    current_fragment = []
                    times_splitted += 1
                    fragment_appended = False
                    was_matched = False
                    i += j
                    j = 0

            else:
                if was_matched:
                    fragments[-1].extend(current_fragment)
                    current_fragment = fragments[-1]  # there was no match, reuse old fragment
                    fragment_appended = True
                    was_matched = False
                    i += j
                    j = 0

                current_fragment.append(splitted_str[i + j])
                i += 1

        if not fragment_appended:
            fragments.append(current_fragment)

        return [String(f) for f in fragments]

    def force_self_style(self, fg=True, bg=False):
        to_ret = []
        for c in self:
            if fg:
                c.fg = self.fg

            if bg:
                c.bg = self.bg

            to_ret.append(c)

        return String(to_ret)

    @property
    def chars(self):
        return self._chars

    @chars.setter
    def chars(self, string):
        if isinstance(string, str):
            self._chars = [Char(c=c) for c in string]

        elif isinstance(string, list):
            self._chars = string

        else:
            raise ValueError("cannot set non Char / str instance")

    def __contains__(self, item):
        return item in repr(self)

    def __getitem__(self, item):
        chars = list(self)
        if isinstance(item, slice):
            to_ret = chars[item]
            return String(to_ret)

        char = chars[item]
        return char

    def __copy__(self):
        return String(copy(self._chars), self.fg, self.bg)

    def normal_iter(self):
        return iter(self._chars)

    def __iter__(self):
        all_iters = []

        for item in self._chars:
            item = copy(item)
            if item.bg is None:
                item.bg = self.bg

            if item.fg is None:
                item.fg = self.fg

            if isinstance(item, String):
                all_iters.append(iter(item))
                continue

            # item is Char class
            all_iters.append([item])

        return chain(*all_iters)

    def __add__(self, other):
        if isinstance(other, String):
            self._chars.append(other)

        if isinstance(other, Char):
            self._chars.append(other)

        if isinstance(other, str):
            self._chars.extend([Char(c=c) for c in other])

        return self

    def format(self):
        return (self.fg or "") + (self.bg or "") + "".join(c.format() for c in self._chars)

    def __repr__(self):
        return "".join(repr(c) for c in self._chars)

    def __str__(self):
        return self.format()
