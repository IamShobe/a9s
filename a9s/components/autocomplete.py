from typing import Callable, Dict

from colored import attr, fg

from a9s.components.custom_string import String
from a9s.components.keys import RIGHT_KEYS, is_match
from a9s.components.logger import logger
from a9s.components.mode import KeyMode
from a9s.components.renderer import Renderer


class AutoComplete(Renderer):
    def __init__(self, commands: Dict[str, Callable]):
        super(AutoComplete, self).__init__()
        self._index = 0
        self._buffer = [" "] * self.width
        self.text = ""

        self.commands = commands
        self.guess_mode = KeyMode.Navigation

    def delete_char(self):
        if len(self.text) > 1:
            self.text = self.text[:-1]

    def get_actual_text(self):
        return self.text[1:]

    def execute_command_if_matched(self):
        for command, func in self.commands.items():
            if command.startswith(self.get_actual_text()):
                return func()

    def handle_key(self, key):
        guessed_command = self.guess_text()
        if is_match(key, RIGHT_KEYS, code_only=True):
            if guessed_command:
                self.text = ":" + guessed_command

    def guess_text(self):
        text = self.get_actual_text()
        if len(text) == 0:
            return ""

        if self.guess_mode == KeyMode.Command:
            for command in self.commands:
                if command.startswith(text.lower()):
                    return command

        return ""

    def draw(self):
        guessed_command = self.guess_text()
        text = self.get_actual_text()
        unmatched_part = guessed_command[len(text):]

        to_print = (String(self.text, fg=attr('reset')) + String(unmatched_part, fg=fg('grey_50'))).pad(self.width)[-self.width:]

        self.echo(to_print)
