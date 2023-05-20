import logging

import random

import boto3
import faker
from botocore.exceptions import ClientError
from mypy_boto3_route53 import Route53Client

TYPE = ['CNAME',
        'A']


def mock_hosted_zones(endpoint: str):
    f = faker.Faker()

    domains = set()

    client: Route53Client = boto3.client('route53', endpoint_url=endpoint)
    for _ in range(10):
        domain = f.domain_name()
        try:
            response = client.create_hosted_zone(Name=domain, CallerReference=domain)
            domains.add(domain)

            host_id = response['HostedZone']['Id']
            record_count = random.randint(1, 30)

            for _ in range(record_count):
                sub_domain = f.domain_word()
                name = f"{sub_domain}.{domain}"
                value = f.ipv4()
                client.change_resource_record_sets(
                    HostedZoneId=host_id,
                    ChangeBatch={
                        'Comment': 'add %s -> %s' % (name, value),
                        'Changes': [
                            {
                                'Action': 'UPSERT',
                                'ResourceRecordSet': {
                                    'Name': name,
                                    'Type': random.choice(TYPE),
                                    'TTL': random.randint(500, 172800),
                                    'ResourceRecords': [{'Value': value}]
                                }
                            }]
                    })

            logging.info(f'Successfully created {domain} domain with {record_count} records')

        except ClientError:
            logging.warning(f'Failure while adding domain `{domain}`')

    return domains
