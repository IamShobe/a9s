import curses
from dataclasses import dataclass

from a9s.components.custom_string import String


TEXT_OVERRIDE = {
    curses.KEY_EXIT: 'ESC',
    curses.KEY_ENTER: 'ENTER',
    curses.KEY_UP: 'UP',
    curses.KEY_DOWN: 'DOWN',
    curses.KEY_RIGHT: 'RIGHT',
    curses.KEY_LEFT: 'LEFT',
    curses.KEY_BACKSPACE: '⌫',
}


def format_special(key):
    if isinstance(key, int):
        return TEXT_OVERRIDE.get(key, key)

    return key


@dataclass
class KeySet:
    keys: tuple
    description: str = ''

    def __add__(self, other: 'KeySet'):
        return KeySet(other.keys + self.keys)

    def format(self, key_style):
        to_ret = String("")
        to_ret += String(", ".join([f'"{format_special(key)}"' for key in self.keys]), fg=key_style).reset_style_on_end()
        if self.description:
            to_ret += String(f" - {self.description}")

        return to_ret


BACK_KEYS = KeySet((curses.KEY_EXIT,), description='Cancel/Go back')
SEARCH_KEYS = KeySet(("/",), description='Search mode')
COMMAND_KEYS = KeySet((":",), description='Command mode')
ENTER_KEYS = KeySet((curses.KEY_ENTER,), description='Select')
DELETE_KEYS = KeySet((curses.KEY_BACKSPACE,))
PASTE_KEYS = KeySet(("\x16",),)  # ctrl + v
COPY_KEYS = KeySet(("y",), description='Yank mode')

LEFT_KEYS = KeySet(('h', curses.KEY_LEFT), description='Go left')
DOWN_KEYS = KeySet(('j', curses.KEY_DOWN), description='Go down')
UP_KEYS = KeySet(('k', curses.KEY_UP), description='Go up')
RIGHT_KEYS = KeySet(('l', curses.KEY_RIGHT), description='Go right')
END_OF_LINE_KEYS = KeySet(('$',), description='Go to end of line')
START_OF_LINE_KEYS = KeySet(('0',), description='Go to start of line')
END_OF_DOC_KEYS = KeySet(('G',), description='Go to bottom')
START_OF_DOC_KEYS = KeySet(('g',), description='Go to top')


def is_match(key, *key_sets: list[KeySet], code_only=False):
    return any(((key.code in key_set.keys) or (not code_only and (key in key_set.keys))) for key_set in key_sets)
