import asyncio
from functools import partial
from dataclasses import dataclass
from typing import Callable

import signal
import pyperclip

from a9s.aws_resources.loader import Loader
from a9s.components.keys import is_match, SEARCH_KEYS, COMMAND_KEYS, ENTER_KEYS, DELETE_KEYS, PASTE_KEYS, BACK_KEYS
from a9s.components.renderer import ScrollableRenderer
from a9s.aws_resources.help import Help
from a9s.aws_resources.logo import Logo
from a9s.aws_resources.hud import HUD
from a9s.aws_resources.services import ServicesSelector
from a9s.components.app import App
from a9s.components.logger import logger
from a9s.components.mode import KeyMode, Mode
from a9s.components.autocomplete import AutoComplete
from a9s import __version__


@dataclass
class Context:
    mode: KeyMode
    focused: Callable[[], ScrollableRenderer]

    def __eq__(self, other):
        return self.mode == other.mode and self.focused() == other.focused()


class MainApp(App):
    def __init__(self):
        self.logo = Logo(__version__)
        self.help = Help()
        self.hud = HUD()
        self.services_selector = ServicesSelector(hud=self.hud)
        self.mode_renderer = Mode()
        self.loader = Loader()
        self.auto_complete = AutoComplete(commands=self.commands)

        super(MainApp, self).__init__([
            self.logo, self.services_selector, self.mode_renderer, self.auto_complete, logger, self.hud, self.help, self.loader,
        ])
        self.context_stack = [Context(mode=KeyMode.Navigation, focused=lambda: self.services_selector.current_service)]

    @property
    def commands(self):
        base_commands = {
            'debug': self.on_debug_command,
            'hideDebug': self.on_hide_debug_command,
            'quit': self.on_quit_command,
        }

        for service_name in self.services_selector.services.keys():
            base_commands[service_name] = partial(self.services_selector.set_service, service_name)

        return base_commands

    def on_debug_command(self):
        current_context = self.context_stack[-1]
        debug_context = Context(mode=KeyMode.Navigation, focused=lambda: logger)
        if current_context != debug_context:
            self.context_stack.append(debug_context)

        logger.halt_debug()
        logger.show()

    def on_hide_debug_command(self):
        current_context = self.context_stack[-1]
        if current_context.focused() == logger:
            self.context_stack.pop()

        logger.hide()

    def on_quit_command(self):
        self.should_run = False

    def on_resize(self, *args):
        self.help.set_pos(x=25, to_x=self.term.width, y=0, to_y=8)
        self.logo.set_pos(x=3, y=0, to_x=24, to_y=6)
        self.hud.set_pos(x=0, y=9, to_x=self.term.width - 1)
        self.loader.set_pos(x=self.term.width-1, y=9, to_x=self.term.width)
        self.mode_renderer.set_pos(x=0, y=self.term.height - 1, to_x=10)
        self.auto_complete.set_pos(x=11, y=self.term.height - 1, to_x=self.term.width)
        self.services_selector.set_pos(x=0, y=10, to_x=self.term.width, to_y=self.term.height - 1)
        logger.set_pos(x=max(self.term.width - 40, 0), y=0, to_x=self.term.width, to_y=10)

        super(MainApp, self).on_resize()

    def on_tick(self, key):
        current_context = self.context_stack[-1]
        self.mode_renderer.mode = current_context.mode
        focused = current_context.focused()
        self.loader.shown = focused.data_updating
        self.help.yank_mode = focused.yank_mode
        self.auto_complete.guess_mode = current_context.mode
        if key:
            logger.debug("pressed key: " + repr(key))

        if current_context.mode == KeyMode.Navigation:
            should_stop_propagate = focused.handle_key(key)
            self.auto_complete.text = ("/" + focused.filter) if focused.filter else ""
            if is_match(key, BACK_KEYS) and not should_stop_propagate:
                if len(self.context_stack) > 1:
                    self.context_stack.pop()
                    logger.debug("Popping context")

            if is_match(key, SEARCH_KEYS):
                self.context_stack.append(Context(mode=KeyMode.Search, focused=current_context.focused))
                logger.debug("Switching to Search mode")
            elif is_match(key, COMMAND_KEYS):
                self.context_stack.append(Context(mode=KeyMode.Command, focused=current_context.focused))
                logger.debug("Switching to Command mode")

            if is_match(key, SEARCH_KEYS, COMMAND_KEYS):
                self.auto_complete.text = str(key)

        if current_context.mode in [KeyMode.Search, KeyMode.Command]:
            if is_match(key, BACK_KEYS):
                self.context_stack.pop()
                logger.debug("Popping context and switching to Navigate mode")

            if is_match(key, PASTE_KEYS):
                self.auto_complete.text += pyperclip.paste().replace("\n", "").replace("\r", "")

            elif is_match(key, DELETE_KEYS):
                self.auto_complete.delete_char()

            elif is_match(key, ENTER_KEYS):
                self.context_stack.pop()
                logger.debug("Popping context and switching to Navigate mode")
                if self.auto_complete.get_actual_text() == "":
                    self.auto_complete.text = ""

                if current_context.mode == KeyMode.Command:
                    self.auto_complete.execute_command_if_matched()

            elif key.isprintable():
                self.auto_complete.text += key

            if current_context.mode == KeyMode.Search:
                focused.filter = self.auto_complete.get_actual_text()

            if current_context.mode == KeyMode.Command:
                self.auto_complete.handle_key(key)

        if current_context.mode == KeyMode.Command:
            if is_match(key, ENTER_KEYS):
                self.auto_complete.text = ""


def main():
    app = MainApp()
    try:
        signal.signal(signal.SIGWINCH, app.on_resize)

    except Exception:
        pass

    asyncio.run(app.run())


if __name__ == '__main__':
    main()
