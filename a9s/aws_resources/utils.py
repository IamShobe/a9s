from typing import TypeVar


T = TypeVar('T')


def pop_if_exists(arr: list[T], *, default: T):
    try:
        return arr.pop()

    except IndexError:
        return default
