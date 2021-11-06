from pyfiglet import Figlet
from rich.align import Align
from rich.console import RenderResult, Console, ConsoleOptions, RenderableType
from rich.text import Text
from textual.widget import Widget

LOGO = [
    "      ________       ",
    "_____/   __   \______",
    "\__  \____    /  ___/",
    " / __ \_/    /\___ \ ",
    "(____  /____//____  >",
    "     \/           \/ "
]


class PrintableLogo:
    def __init__(self, version):
        self.version = version

    def __rich_console__(
            self, console: Console, options: ConsoleOptions
    ) -> RenderResult:
        # for i, line in enumerate(self.data[self.displayed_data_start:self.displayed_data_end]):
        #     actual_row_index = i + self.displayed_data_start
        #     style = 'black on rgb(200,200,200)' if actual_row_index == self.selected_row else ''
        #     yield Text(self._get_printable_line(line, options), style=style)
        font = Figlet(font="small", width=options.max_width)
        yield Align.center(Text(font.renderText("a9s").strip("\n"), style="bold"))
        yield Align.center(self.version)


class Logo(Widget):
    def __init__(self, version):
        super(Logo, self).__init__()
        self.version = version

    def render(self) -> RenderableType:
        return PrintableLogo(version=self.version)
