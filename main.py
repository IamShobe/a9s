from aws_resources.s3 import S3Table
from logging import log
import signal
import curses
import pyperclip
import boto3
from colored import fg

from components.app import App
from components.custom_string import String
from components.logger import logger
from components.mode import KeyMode, Mode
from components.table import ColSettings, Table
from components.autocomplete import AutoComplete

def main():
    app = App()
    # headers = [ColSettings(name="test"), ColSettings(name="test2", stretched=True), ColSettings(name="non stretched")]
    # rendered_list = [["test", "test123", "sdgfsdfg234234234sdg"], ["test2", "234234", "sdgsdfgaswrsdgc xb"],
    #                  ["test 124 124 124 12 4213", "sdgdfgfdg", "sdgfsd sdfas dff"]] * 100

    # headers, rendered_list = list_bucket('test-bucket')


    table = S3Table()
    
    # def on_select(data):
    #     global s3_mode
    #     global selected_bucket
    #     logger.debug("Row is {}".format(data))
    #     if s3_mode == "select_bucket":
    #         selected_bucket = data['Bucket name']
    #         headers, rendered_list = list_bucket('test-bucket')
    #         table.headers = headers
    #         table.data = rendered_list
    #         s3_mode = "select_folder"

    # table.on_select = on_select
    auto_complete = AutoComplete()
    mode_renderer = Mode()

    def on_resize(*args):
        mode_renderer.set_pos(x=0, y=9, to_x=10)
        auto_complete.set_pos(x=11, y=9, to_x=app.term.width)
        table.set_pos(x=0, y=10, to_x=app.term.width, to_y=app.term.height)
        logger.set_pos(x=max(app.term.width - 40, 0), y=0, to_x=app.term.width, to_y=10)
        table.onresize()
        app.resize()
        auto_complete.to_x = app.term.width
        app.clear()

    try:
        signal.signal(signal.SIGWINCH, on_resize)

    except Exception:
        pass

    on_resize()
    app.add_multiple([table, mode_renderer, auto_complete, logger])

    mode_renderer.mode = KeyMode.Navigation
    for key in app.interactive_run():
        original_mode = mode_renderer.mode
        app.echo(0, 0, "width: " + str(app.term.width) + " height: " + str(app.term.height) + " " * 10)
        if key:
            logger.debug("pressed key: " + repr(key))

        if key.code == curses.KEY_EXIT:
            auto_complete.text = ""

        if original_mode == KeyMode.Navigation:
            if key.code == curses.KEY_EXIT:
                table.filter = auto_complete.get_actual_text()

            table.handle_key(key)
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

                if auto_complete.get_actual_text() in "debug":
                    mode_renderer.mode = KeyMode.Debug
                    logger.shown = True
                    logger.halt_debug()

            elif key.isprintable():
                auto_complete.text += key

            if original_mode == KeyMode.Search:
                table.filter = auto_complete.get_actual_text()

        if original_mode == KeyMode.Command:
            if key.code == curses.KEY_ENTER:
                auto_complete.text = ""


if __name__ == '__main__':
    main()
