import signal
import curses
import pyperclip

from .aws_resources.hud import HUD
from .aws_resources.services import ServicesSelector
from .components.app import App
from .components.logger import logger
from .components.mode import KeyMode, Mode
from .components.autocomplete import AutoComplete


def main():
    app = App()

    hud = HUD()
    services_selector = ServicesSelector(hud)

    mode_renderer = Mode()

    def debug():
        mode_renderer.mode = KeyMode.Debug
        logger.shown = True
        logger.halt_debug()

    def quit():
        app.should_run = False

    commands = {
        'debug': debug,
        'quit': quit,
        's3': lambda: services_selector.set_service('s3'),
        'route53': lambda: services_selector.set_service('route53'),
    }
    auto_complete = AutoComplete(commands)

    def on_resize(*args):
        hud.set_pos(x=0, y=9, to_x=app.term.width)
        mode_renderer.set_pos(x=0, y=app.term.height - 1, to_x=10)
        auto_complete.set_pos(x=11, y=app.term.height - 1, to_x=app.term.width)
        services_selector.set_pos(x=0, y=10, to_x=app.term.width, to_y=app.term.height - 1)
        logger.set_pos(x=max(app.term.width - 40, 0), y=0, to_x=app.term.width, to_y=10)
        services_selector.onresize()
        app.resize()
        auto_complete.to_x = app.term.width
        app.clear()

    try:
        signal.signal(signal.SIGWINCH, on_resize)

    except Exception:
        pass

    on_resize()
    app.add_multiple([services_selector, mode_renderer, auto_complete, logger, hud])

    mode_renderer.mode = KeyMode.Navigation
    for key in app.interactive_run():
        original_mode = mode_renderer.mode
        app.echo(0, 0, "width: " + str(app.term.width) + " height: " + str(app.term.height) + " " * 10)
        if key:
            logger.debug("pressed key: " + repr(key))

        if key.code == curses.KEY_EXIT:
            auto_complete.text = ""

        if original_mode == KeyMode.Navigation:
            should_stop = services_selector.handle_key(key)
            auto_complete.text = ("/" + services_selector.current_service.filter) if services_selector.current_service.filter else ""
            if key.code == curses.KEY_EXIT and not should_stop:
                services_selector.current_service.filter = ""

            if key == "/":
                mode_renderer.mode = KeyMode.Search
                logger.debug("Switching to Search mode")
            elif key == ":":
                mode_renderer.mode = KeyMode.Command
                logger.debug("Switching to Command mode")

            if key in ["/", ":"]:
                auto_complete.text = str(key)

        if original_mode == KeyMode.Debug:
            if key.code == curses.KEY_EXIT:
                mode_renderer.mode = KeyMode.Navigation
                logger.shown = False
                logger.continue_debug()

            else:
                logger.handle_key(key)

        if original_mode in [KeyMode.Search, KeyMode.Command]:
            if key.code == curses.KEY_EXIT:
                mode_renderer.mode = KeyMode.Navigation
                logger.debug("Switching to Navigate mode")

            if key == "\x16":  # ctrl + v
                auto_complete.text += pyperclip.paste().replace("\n", "").replace("\r", "")

            elif key.code == curses.KEY_BACKSPACE:
                auto_complete.delete_char()

            elif key.code == curses.KEY_ENTER:
                mode_renderer.mode = KeyMode.Navigation
                logger.debug("Switching to Navigate mode")
                if auto_complete.get_actual_text() == "":
                    auto_complete.text = ""

                auto_complete.execute_command_if_matched()

            elif key.isprintable():
                auto_complete.text += key

            if original_mode == KeyMode.Search:
                services_selector.current_service.filter = auto_complete.get_actual_text()

            if original_mode == KeyMode.Command:
                auto_complete.handle_key(key)

        if original_mode == KeyMode.Command:
            if key.code == curses.KEY_ENTER:
                auto_complete.text = ""


if __name__ == '__main__':
    main()
