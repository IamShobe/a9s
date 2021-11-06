import asyncio
import logging
from dataclasses import dataclass
from functools import partial
from threading import Timer, Thread, Event

from typing import Callable, List

import pyperclip
from rich.align import Align
from rich.console import Console, ConsoleOptions, RenderResult, RenderableType
from rich.padding import Padding
from rich.text import Text, Segment
from rich.panel import Panel
from rich.table import Table
from textual import events

from textual.app import App
from textual.geometry import Offset
from textual.reactive import Reactive, watch
from textual.views import GridView
from textual.widget import Widget
from textual.widgets import Button, ButtonPressed, Placeholder, ScrollView, DirectoryTree
from pyfiglet import Figlet

from a9s.components.keys import is_match, ENTER_KEYS, DELETE_KEYS, PASTE_KEYS, BACK_KEYS, SEARCH_KEYS, COMMAND_KEYS
from a9s.components.table import ColSettings
from a9s.v2_aws_resources.logo import Logo
from a9s.v2_aws_resources.route53 import Route53Table
from a9s.v2_components.List import ListWidget

# class FigletText:
#     """A renderable to generate figlet text that adapts to fit the container."""
#
#     def __init__(self, text: str) -> None:
#         self.text = text
#
#     def __rich_console__(
#         self, console: Console, options: ConsoleOptions
#     ) -> RenderResult:
#         """Build a Rich renderable to render the Figlet text."""
#         size = min(options.max_width / 2, options.max_height)
#         if size < 4:
#             yield Text(self.text, style="bold")
#         else:
#             if size < 7:
#                 font_name = "mini"
#             elif size < 8:
#                 font_name = "small"
#             elif size < 10:
#                 font_name = "standard"
#             else:
#                 font_name = "big"
#             font = Figlet(font=font_name, width=options.max_width)
#             yield Text(font.renderText(self.text).rstrip("\n"), style="bold")
#             yield Segment("My")
#             yield Segment("My")
from a9s.v2_components.Table import TableWidget
from a9s.v2_components.autocomplete import AutoComplete
from a9s.v2_components.hud import HUD
from a9s.v2_components.mode import Mode, KeyMode
from a9s.v2_aws_resources.services import ServicesSelector


class Numbers(Widget):
    """The digital display of the calculator."""

    value = Reactive("0")

    def render(self) -> RenderableType:
        """Build a Rich renderable to render the calculator display."""
        return Panel("test", title="Hello, [red]World!", title_align="left")


class Header(GridView):
    async def on_mount(self, event: events.Mount) -> None:
        self.grid.add_column("logo", size=15)
        self.grid.add_column("col")
        self.grid.add_row("row")
        self.grid.add_areas(
            logo="logo,row",
            # help="col,row",
        )
        self.grid.place(Numbers(), logo=Logo("development"))


class Footer(GridView):
    def __init__(self, commands):
        super(Footer, self).__init__()
        self.mode = Mode()
        self.autocomplete = AutoComplete(commands)

    async def on_mount(self, event: events.Mount) -> None:
        self.grid.add_column("mode", size=10)
        self.grid.add_column("col")
        self.grid.add_row("row")
        self.grid.add_areas(
            mode="mode,row",
            autocomplete="col,row",
        )
        self.grid.place(mode=self.mode, autocomplete=self.autocomplete)


class RepeatingTimer(Thread):
    def __init__(self, event, callback):
        super(RepeatingTimer, self).__init__()
        self.callback = callback
        self.stopped = event
        self.loop = asyncio.get_event_loop()

    def run(self) -> None:
        while not self.stopped.wait(0.1):
            asyncio.run_coroutine_threadsafe(self.callback(), loop=self.loop)


class ServiceView(GridView):
    def __init__(self, on_filter_change):
        super(ServiceView, self).__init__()
        self.hud = HUD()
        self.services_selector = ServicesSelector(on_filter_change=on_filter_change, hud=self.hud)
        self.footer = Footer(self.commands)
        self._on_filter_change = on_filter_change

    async def on_mount(self, event: events.Mount) -> None:
        self.grid.add_row("hud", size=1)
        self.grid.add_row("row")
        self.grid.add_column("col")
        self.grid.add_row("footer", size=1)
        self.grid.add_areas(
            hud="col,hud",
            footer="col,footer",
            # help="col,row",
        )
        # await self.services_selector.focus()
        self.grid.place(self.services_selector, hud=self.hud, footer=self.footer)
        await self.call_later(self.initialize)
        # self.timer.start()

    async def initialize(self):
        await self.services_selector.set_service('route53')
        # await self.hud.initialize()

    async def on_debug_command(self):
        pass
        # current_context = self.context_stack[-1]
        # debug_context = Context(mode=KeyMode.Navigation, focused=lambda: logger)
        # if current_context != debug_context:
        #     self.context_stack.append(debug_context)
        #
        # logger.halt_debug()
        # logger.show()

    async def on_hide_debug_command(self):
        pass
        # current_context = self.context_stack[-1]
        # if current_context.focused() == logger:
        #     self.context_stack.pop()
        #
        # logger.hide()

    async def on_quit_command(self):
        self.should_run = False

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


@dataclass
class Context:
    mode: KeyMode
    focused: Callable[[], Widget]

    def __eq__(self, other):
        return self.mode == other.mode and self.focused() == other.focused()


class AppLayout(GridView):
    context_stack: List[Context] = Reactive([])

    def __init__(self):
        super(AppLayout, self).__init__()
        self.service_view = ServiceView(on_filter_change=self.on_filter_change)
        self.stop_event = Event()
        self.timer = RepeatingTimer(self.stop_event, self.refresh_animation)

    async def refresh_animation(self):
        await self.service_view.hud.force_update()
        # self.main.refresh()

    def update_mode(self):
        logger = logging.getLogger('app')
        logger.debug("reached here!!")
        current_context = self.context_stack[-1]
        # self.service_view.hud
        self.service_view.footer.mode.mode = current_context.mode
        self.service_view.footer.autocomplete.guess_mode = current_context.mode

    def watch_context_stack(self, current_stack):
        self.update_mode()
        # logger = logging.getLogger('app')
        # logger.debug("reached here!!")
        # current_context = current_stack[-1]
        # # self.service_view.hud
        # self.focused = current_context.focused()
        # self.service_view.footer.mode.mode = current_context.mode
        # self.service_view.footer.autocomplete.guess_mode = current_context.mode
        # # self.mode_renderer.mode = current_context.mode
        # # focused = current_context.focused()
        # # self.loader.shown = focused.data_updating
        # # self.help.yank_mode = focused.yank_mode

    async def on_mount(self, event: events.Mount) -> None:
        """Event when widget is first mounted (added to a parent view)."""
        # self.grid.set_gutter(1)
        # self.grid.set_align("center", "center")
        self.grid.add_column("col")
        self.grid.add_row("header", size=7)
        self.grid.add_row("row")
        self.grid.add_areas(
            header="col,header",
            body="col,row",
        )
        header = Header()
        self.grid.place(body=self.service_view, header=header)
        await self.service_view.focus()
        self.timer.start()

        async def initialize():
            self.context_stack.append(Context(mode=KeyMode.Navigation, focused=lambda: self.service_view.services_selector.service))
            self.update_mode()
            # watch(self.focused, "filter", self.on_filter_change)
            # await self.service_view.initialize()

        await self.call_later(initialize)

    async def on_filter_change(self, value):
        current_context = self.context_stack[-1]
        if current_context.mode == KeyMode.Navigation:
            self.auto_complete.text = f"/{value}" if value else ""

    @property
    def auto_complete(self):
        return self.service_view.footer.autocomplete

    def pop_stack(self):
        copy_stack = [*self.context_stack]
        copy_stack.pop()
        self.context_stack = copy_stack

    def add_to_stack(self, context: Context):
        self.context_stack = [*self.context_stack, context]

    async def on_key(self, event):
        logger = logging.getLogger('app')
        logger.debug(event)
        current_context = self.context_stack[-1]
        focused = current_context.focused()

        key = event.key
        is_special = len(key) > 1
        if key:
            logger.debug("pressed key: " + repr(key))

        if current_context.mode == KeyMode.Navigation:
            should_stop_propagate = await focused.handle_key(key)

            if is_match(key, BACK_KEYS) and not should_stop_propagate:
                if len(self.context_stack) > 1:
                    self.context_stack.pop()
                    logger.debug("Popping context")

            if is_match(key, SEARCH_KEYS):
                self.add_to_stack(Context(mode=KeyMode.Search, focused=current_context.focused))
                logger.debug("Switching to Search mode")
            elif is_match(key, COMMAND_KEYS):
                self.add_to_stack(Context(mode=KeyMode.Command, focused=current_context.focused))
                logger.debug("Switching to Command mode")

            if is_match(key, SEARCH_KEYS, COMMAND_KEYS):
                self.auto_complete.text = str(key)

        if current_context.mode in [KeyMode.Search, KeyMode.Command]:
            if is_match(key, BACK_KEYS):
                self.pop_stack()
                logger.debug("Popping context and switching to Navigate mode")

            if is_match(key, PASTE_KEYS):
                self.auto_complete.text += pyperclip.paste().replace("\n", "").replace("\r", "")

            elif is_match(key, DELETE_KEYS):
                self.auto_complete.delete_char()

            elif is_match(key, ENTER_KEYS):
                self.pop_stack()
                logger.debug("Popping context and switching to Navigate mode")
                if self.auto_complete.get_actual_text() == "":
                    self.auto_complete.text = ""

                if current_context.mode == KeyMode.Command:
                    await self.auto_complete.execute_command_if_matched()

            elif key.isprintable() and not is_special:
                self.auto_complete.text += key

            if current_context.mode == KeyMode.Search:
                focused.filter = self.auto_complete.get_actual_text()

            if current_context.mode == KeyMode.Command:
                self.auto_complete.handle_key(key)

        if current_context.mode == KeyMode.Command:
            if is_match(key, ENTER_KEYS) and focused:
                self.auto_complete.text = f"/{focused.filter}" if focused.filter else ""


class A9SApp(App):
    """The Calculator Application"""

    def __init__(self, *args, **kwargs):
        super(A9SApp, self).__init__(*args, **kwargs)
        self.main = AppLayout()

    async def on_mount(self) -> None:
        """Mount the calculator widget."""
        await self.view.dock(self.main)
        await self.main.focus()


A9SApp.run(title="a9s", log="textual.log")
