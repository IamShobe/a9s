from colored import fg
from rich.console import RenderableType
from rich.spinner import Spinner
from textual.widget import Widget

from a9s.components.custom_string import String


class Loader(Widget):
    # MAX_FRAMES = len(FRAMES)

    def render(self) -> RenderableType:
        return Spinner('dots2', style='green')

    # def draw(self):
    #     if self.frame >= self.MAX_FRAMES:
    #         self.frame = 0
    #
    #     current_frame = self.frame % len(FRAMES)
    #     self.echo(String(FRAMES[current_frame], fg=fg('light_green_3')))
    #
    #     self.frame += 1

