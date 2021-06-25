from pkg_resources import get_distribution

try:
    package = get_distribution(__package__)
    __version__ = package.version

except:
    __version__ = 'unknown'
