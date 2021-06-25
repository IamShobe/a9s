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

    def draw(self, echo):
        self._curr_row = 0
        for line in LOGO:
            echo(self.x, self.y + self._curr_row, line)
            self._curr_row += 1

        version_text = f"v{self.version}"
        version_x_pos = round(self.width / 2 - len(version_text) / 2 + self.x)
        echo(version_x_pos, self.y + self._curr_row, version_text)
