FROM python:3.9-alpine AS base
RUN apk add --update build-base alpine-sdk libffi-dev openssl-dev python3-dev rust cargo pyo3
RUN pip install poetry
# Application dependencies
COPY pyproject.toml poetry.lock /app/

WORKDIR /app/
RUN POETRY_VIRTUALENVS_IN_PROJECT=true poetry install --no-root --no-dev
COPY README.md /app/
COPY a9s /app/a9s/
RUN POETRY_VIRTUALENVS_IN_PROJECT=true poetry install --no-dev
CMD poetry run a9s


FROM python:3.9-alpine3.12
WORKDIR /app/
RUN apk add vim
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/tembel:${PYTHONPATH}"
COPY --from=base /app/ /app/

# Application files
CMD a9s
