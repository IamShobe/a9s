from colored import fg, attr

from a9s.components.custom_string import String
from a9s.components.keys import SEARCH_KEYS, BACK_KEYS, COPY_KEYS, COMMAND_KEYS, END_OF_DOC_KEYS, START_OF_DOC_KEYS, START_OF_LINE_KEYS, END_OF_LINE_KEYS, \
    RIGHT_KEYS, LEFT_KEYS, DOWN_KEYS, UP_KEYS
from a9s.components.renderer import Renderer


NAV_COLUMN = [LEFT_KEYS, DOWN_KEYS, UP_KEYS, RIGHT_KEYS, START_OF_LINE_KEYS, END_OF_LINE_KEYS, START_OF_DOC_KEYS, END_OF_DOC_KEYS]


class Help(Renderer):
    COL_WIDTH = 25
    def __init__(self):
        super(Help, self).__init__()
        self.yank_mode = False

    def draw(self):
        command_style = fg('orchid_1') + attr('bold')
        key_style = fg('dodger_blue_2') + attr('bold')
        special_style = fg('medium_orchid') + attr('bold')
        self.echo(String("Keys:", fg=fg('orange_1') + attr('bold')))

        self.echo(String(" ") + SEARCH_KEYS.format(command_style))
        self.echo(String(" ") + COMMAND_KEYS.format(command_style))
        self.echo(String(" ") + BACK_KEYS.format(command_style))
        self.echo("-" * self.COL_WIDTH)
        yank_text = String(" ") + COPY_KEYS.format(special_style)
        if self.yank_mode:
            yank_text += String(" (ON)")

        else:
            yank_text.pad(self.COL_WIDTH)

        self.echo(yank_text)

        self.set_relative_pos(x=self.COL_WIDTH, y=1)
        for key_set in NAV_COLUMN:
            self.echo(String(" ") + key_set.format(key_style))
