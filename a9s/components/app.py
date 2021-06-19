import os
import sys
from typing import List
import tempfile
from subprocess import call

from blessed import Terminal
from colored import attr

from .custom_string import String
from .renderer import Renderer


EDITOR = os.environ.get('EDITOR', 'vim')


def flush():
    sys.stdout.flush()


class App:
    def __init__(self):
        self.term = Terminal()
        self.render_list = []
        self.should_run = True

        self.buffer = [[' ' for x in range(self.term.width)] for y in range(self.term.height)]

    def dump_to_screen(self):
        for line_num, line in enumerate(self.buffer):
            sys.stdout.write(self.term.move_xy(0, line_num) + "".join(line) + attr("reset"))

        sys.stdout.write(attr("reset"))

    def resize(self):
        self.buffer = [[' ' for x in range(self.term.width)] for y in range(self.term.height)]

    def echo(self, x, y, to_print):
        if isinstance(to_print, str):
            to_print = String(to_print)

        if y >= len(self.buffer) or x + len(to_print) > len(self.buffer[0]):
            return

        line = self.buffer[y]
        to_print.reset_style_on_end()
        for i, char in enumerate(to_print):
            actual_x = x + i
            line[actual_x] = str(char)

    def clear(self):
        sys.stdout.write(self.term.clear)
        self.buffer = [[' ' for x in range(self.term.width)] for y in range(self.term.height)]

    def add_to_render(self, renderer: Renderer):
        self.render_list.append(renderer)

    def add_multiple(self, renders: List[Renderer]):
        self.render_list.extend(renders)

    @classmethod
    def get_editor_input(cls, initial_text: str = ""):
        with tempfile.NamedTemporaryFile(suffix=".tmp") as tf:
            tf.write(initial_text.encode())
            tf.flush()
            call([EDITOR, tf.name])

            # do the parsing with `tf` using regular File operations.
            # for instance:
            tf.seek(0)
            return tf.read().decode()

    def interactive_run(self):
        with self.term.fullscreen():
            with self.term.cbreak(), self.term.raw():
                while self.should_run:
                    # self.echo(0, 0, self.term.clear)
                    with self.term.hidden_cursor():
                        for renderer in self.render_list:
                            renderer.draw(self.echo)

                        self.dump_to_screen()
                        flush()

                        key = self.term.inkey(timeout=0.1)
                        if key in [chr(3)]:
                            break

                        yield key
