from typing import Callable, Dict

from colored import attr, fg

# from a9s.components.custom_string import String
from rich.console import RenderableType, RenderResult, Console, ConsoleOptions
from rich.text import Text
from textual.reactive import Reactive
from textual.widget import Widget

from a9s.components.keys import RIGHT_KEYS, is_match
# from a9s.components.renderer import Renderer
from a9s.v2_components.Table import logger
from a9s.v2_components.mode import KeyMode


class PrintAutoComplete:
    SERVICE_SPACE = 10

    def __init__(self, text, unmatched_part):
        self.text = text
        self.unmatched_part = unmatched_part

    def __rich_console__(
            self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        width = options.max_width
        yield (Text(self.text, style='reset') + Text(self.unmatched_part, style='grey19'))[-width:]


class AutoComplete(Widget):
    text = Reactive("")
    guess_mode = Reactive(KeyMode.Navigation)

    def __init__(self, commands: Dict[str, Callable]):
        super(AutoComplete, self).__init__()
        self._index = 0

        self.commands = commands

    def delete_char(self):
        logger.info(f"deleting key from {self.text}")
        if len(self.text) > 1:
            self.text = self.text[:-1]
            logger.info(f"new key is {self.text}")

    def get_actual_text(self):
        return self.text[1:]

    async def execute_command_if_matched(self):
        for command, func in self.commands.items():
            if command.startswith(self.get_actual_text()):
                return await func()

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

    def render(self) -> RenderableType:
        guessed_command = self.guess_text()
        text = self.get_actual_text()
        unmatched_part = guessed_command[len(text):]
        logger.info(f'{self.commands}, {self.guess_mode}, {text}, {guessed_command}, {unmatched_part}, {self.guess_mode == KeyMode.Command}')

        return PrintAutoComplete(text, unmatched_part)
