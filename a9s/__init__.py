from importlib.metadata import version as get_version

try:
    __version__ = get_version(__package__)

except:
    __version__ = 'unknown'
