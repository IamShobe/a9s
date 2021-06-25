import signal
import curses
import pyperclip

from .aws_resources.logo import Logo
from .aws_resources.hud import HUD
from .aws_resources.services import ServicesSelector
from .components.app import App
from .components.logger import logger
from .components.mode import KeyMode, Mode
from .components.autocomplete import AutoComplete
from . import __version__


class MainApp(App):
    def __init__(self):
        super(MainApp, self).__init__()
        self.logo = Logo(__version__)
        self.hud = HUD()
        self.services_selector = ServicesSelector(hud=self.hud)
        self.mode_renderer = Mode()

        self.auto_complete = AutoComplete(commands=self.commands)
        self.add_multiple([self.logo, self.services_selector, self.mode_renderer, self.auto_complete, logger, self.hud])

        self.on_resize()

    @property
    def commands(self):
        return {
            'debug': self.on_debug_command,
            'quit': self.on_quit_command,

            's3': lambda: self.services_selector.set_service('s3'),
            'route53': lambda: self.services_selector.set_service('route53'),
        }

    def on_debug_command(self):
        self.mode_renderer.mode = KeyMode.Debug
        logger.halt_debug()

    def on_quit_command(self):
        self.should_run = False

    def on_resize(self, *args):
        self.logo.set_pos(x=3, y=0, to_x=24, to_y=6)
        self.hud.set_pos(x=0, y=9, to_x=self.term.width)
        self.mode_renderer.set_pos(x=0, y=self.term.height - 1, to_x=10)
        self.auto_complete.set_pos(x=11, y=self.term.height - 1, to_x=self.term.width)
        self.services_selector.set_pos(x=0, y=10, to_x=self.term.width, to_y=self.term.height - 1)
        logger.set_pos(x=max(self.term.width - 40, 0), y=0, to_x=self.term.width, to_y=10)
        self.services_selector.onresize()
        self.resize()
        self.auto_complete.to_x = self.term.width
        self.clear()

    def run(self):
        self.mode_renderer.mode = KeyMode.Navigation
        for key in self.interactive_run():
            original_mode = self.mode_renderer.mode
            if key:
                logger.debug("pressed key: " + repr(key))

            if key.code == curses.KEY_EXIT:
                self.auto_complete.text = ""

            if original_mode == KeyMode.Navigation:
                should_stop = self.services_selector.handle_key(key)
                self.auto_complete.text = ("/" + self.services_selector.current_service.filter) if self.services_selector.current_service.filter else ""
                if key.code == curses.KEY_EXIT and not should_stop:
                    self.services_selector.current_service.filter = ""

                if key == "/":
                    self.mode_renderer.mode = KeyMode.Search
                    logger.debug("Switching to Search mode")
                elif key == ":":
                    self.mode_renderer.mode = KeyMode.Command
                    logger.debug("Switching to Command mode")

                if key in ["/", ":"]:
                    self.auto_complete.text = str(key)

            if original_mode == KeyMode.Debug:
                if key.code == curses.KEY_EXIT:
                    self.mode_renderer.mode = KeyMode.Navigation
                    logger.continue_debug()

                else:
                    logger.handle_key(key)

            if original_mode in [KeyMode.Search, KeyMode.Command]:
                if key.code == curses.KEY_EXIT:
                    self.mode_renderer.mode = KeyMode.Navigation
                    logger.debug("Switching to Navigate mode")

                if key == "\x16":  # ctrl + v
                    self.auto_complete.text += pyperclip.paste().replace("\n", "").replace("\r", "")

                elif key.code == curses.KEY_BACKSPACE:
                    self.auto_complete.delete_char()

                elif key.code == curses.KEY_ENTER:
                    self.mode_renderer.mode = KeyMode.Navigation
                    logger.debug("Switching to Navigate mode")
                    if self.auto_complete.get_actual_text() == "":
                        self.auto_complete.text = ""

                    self.auto_complete.execute_command_if_matched()

                elif key.isprintable():
                    self.auto_complete.text += key

                if original_mode == KeyMode.Search:
                    self.services_selector.current_service.filter = self.auto_complete.get_actual_text()

                if original_mode == KeyMode.Command:
                    self.auto_complete.handle_key(key)

            if original_mode == KeyMode.Command:
                if key.code == curses.KEY_ENTER:
                    self.auto_complete.text = ""


def main():
    app = MainApp()

    try:
        signal.signal(signal.SIGWINCH, app.on_resize)

    except Exception:
        pass

    app.run()


if __name__ == '__main__':
    main()
