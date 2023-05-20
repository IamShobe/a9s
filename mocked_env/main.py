import os

from mocked_env.dynamodb import mock_tables
from mocked_env.route53 import mock_hosted_zones
from mocked_env.s3 import mock_buckets


ENDPOINT = os.environ.get('SERVER_URL', 'http://localhost:54321')


def run_all_mocks():
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["AWS_ACCESS_KEY_ID"] = "test"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "test"
    mock_hosted_zones(ENDPOINT)
    mock_buckets(ENDPOINT)
    mock_tables(ENDPOINT)


if __name__ == '__main__':
    run_all_mocks()
