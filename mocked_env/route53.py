import random

import boto3
import faker


TYPE = ['CNAME',
        'A']


def mock_hosted_zones(endpoint):
    f = faker.Faker()

    client = boto3.client('route53', endpoint_url=endpoint)
    for _ in range(10):
        domain = f.domain_name()
        response = client.create_hosted_zone(Name=domain, CallerReference=domain)

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

    return
