from pkg_resources import get_distribution

try:
    package = get_distribution(__package__)
    __version__ = package.version
    if __version__ == '0':
        __version__ = 'development'

    else:
        __version__ = 'v' + __version__

except:
    __version__ = 'unknown'
