from a9s.version_file import version

__version__ = version
if __version__ != 'development':
    __version__ = 'v' + __version__
