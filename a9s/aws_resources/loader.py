from colored import fg

from a9s.components.custom_string import String
from a9s.components.renderer import Renderer

FRAMES = "⣾⣽⣻⢿⡿⣟⣯⣷"


class Loader(Renderer):
    MAX_FRAMES = len(FRAMES)

    def __init__(self):
        super(Loader, self).__init__()
        self.frame = 0
        self.shown = False

    def draw(self):
        if self.frame >= self.MAX_FRAMES:
            self.frame = 0

        current_frame = self.frame % len(FRAMES)
        to_print = FRAMES[current_frame] if self.shown else " "
        self.echo(String(to_print, fg=fg('light_green_3')))

        self.frame += 1

