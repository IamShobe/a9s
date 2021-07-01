import os

from mocked_env.route53 import mock_hosted_zones
from mocked_env.s3 import mock_buckets


ENDPOINT = os.environ.get('SERVER_URL', 'http://localhost:54321')


def run_all_mocks():
    mock_hosted_zones(ENDPOINT)
    mock_buckets(ENDPOINT)


if __name__ == '__main__':
    run_all_mocks()
