from colored import fg, attr

from a9s.components.custom_string import String
from a9s.components.renderer import Renderer


class Help(Renderer):

    def draw(self):
        key_style = fg('dodger_blue_2') + attr('bold')
        self.echo(String("Keys:", fg=fg('orange_1') + attr('bold')))
        # self.echo(String(" ") + String("?", fg=key_style).reset_style_on_end() + String(" - Help"))
        self.echo(String(" ") + String("/", fg=key_style).reset_style_on_end() + String(" - Search mode"))
        self.echo(String(" ") + String(":", fg=key_style).reset_style_on_end() + String(" - Command mode"))
        self.echo(String(" ") + String("ESC", fg=key_style).reset_style_on_end() + String(" - Cancel/Go Back"))
