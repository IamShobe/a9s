FROM python:3.9-alpine AS base
RUN apk add --update build-base alpine-sdk libffi-dev openssl-dev python3-dev rust cargo pyo3
RUN pip install poetry
# Application dependencies
COPY pyproject.toml poetry.lock /app/

WORKDIR /app/
RUN POETRY_VIRTUALENVS_IN_PROJECT=true poetry install
COPY README.md /app/
COPY mocked_env /app/mocked_env/
RUN poetry run moto_server -p 54321 &
RUN poetry run python -m mocked_env.main
CMD fg
