import random
import logging
from io import BytesIO

import faker
import boto3
from mypy_boto3_s3 import S3Client
from botocore.exceptions import ClientError


def mock_buckets(endpoint):
    f = faker.Faker()

    client: S3Client = boto3.client('s3', endpoint_url=endpoint)
    buckets = set()
    for _ in range(40):
        bucket_name = f.word()
        try:
            client.create_bucket(Bucket=bucket_name)
            tags = []
            tag_count = random.randint(0, 4)
            for _ in range(tag_count):
                key = f.word()
                value = f.word()
                tags.append({'Key': key, 'Value': value})

            if tags:
                client.put_bucket_tagging(Bucket=bucket_name, Tagging={"TagSet": tags})

            files_count = random.randint(0, 40)
            for _ in range(files_count):
                key = f.file_path(depth=random.randint(0, 4)).lstrip('/')
                bytes_count = random.randint(1, 10)
                client.upload_fileobj(Bucket=bucket_name, Key=key, Fileobj=BytesIO(b'0' * bytes_count))

            logging.info(f'Successfully created {bucket_name} bucket with {files_count} files')

        except ClientError:
            logging.warning(f'Failure while adding bucket `{bucket_name}`')

    return buckets
