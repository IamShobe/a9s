FROM python:3.9-alpine AS base
RUN apk --update add gcc musl-dev libffi-dev openssl-dev
RUN apk add gcc musl-dev python3-dev libffi-dev openssl-dev cargo
RUN pip install poetry
# Application dependencies
COPY pyproject.toml poetry.lock /app/

WORKDIR /app/
RUN POETRY_VIRTUALENVS_IN_PROJECT=true poetry install --no-root
COPY README.md /app/
COPY mocked_env /app/mocked_env/
ENV AWS_DEFAULT_REGION=us-west-2
ENV AWS_ACCESS_KEY_ID=test
ENV AWS_SECRET_ACCESS_KEY=test
CMD poetry run moto_server -H 0.0.0.0 -p 54321
