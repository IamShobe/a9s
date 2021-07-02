

def pop_if_exists(arr, default=None):
    try:
        return arr.pop()

    except IndexError:
        return default
