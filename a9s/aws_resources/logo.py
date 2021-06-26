from a9s.components.renderer import Renderer

LOGO = [
    "      ________       ",
    "_____/   __   \______",
    "\__  \____    /  ___/",
    " / __ \_/    /\___ \ ",
    "(____  /____//____  >",
    "     \/           \/ "
]



class Logo(Renderer):
    def __init__(self, version):
        super(Logo, self).__init__()
        self.version = version

    def draw(self):
        for line in LOGO:
            self.echo(line)

        version_text = self.version
        version_x_pos = round(self.width / 2 - len(version_text) / 2 + self.x)
        self.echo(version_text, x=version_x_pos)
