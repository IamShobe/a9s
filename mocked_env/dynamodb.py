import logging
import random

import boto3
import faker

TYPE = ['N', 'S']

def mock_tables(endpoint):
    f = faker.Faker()
    tables = set()

    client = boto3.client('dynamodb', endpoint_url=endpoint)
    for _ in range(10):
        table_name = f.domain_word()
        try:
            fields_count = random.randint(2, 5)
            definitions = []
            for _ in range(fields_count):
                field_name = f.word()
                field_type = TYPE[random.randint(0, len(TYPE) - 1)]
                definitions.append({'AttributeName': field_name, 'AttributeType': field_type})

            keyschema = [{'AttributeName': definition['AttributeName'], 'KeyType': 'HASH'} for definition in definitions]
            logging.info(f'Creating table {table_name} with {keyschema} keyschema and {definitions}')

            client.create_table(TableName=table_name, AttributeDefinitions=definitions,
                                KeySchema=keyschema)
            logging.info(f'Successfully created {table_name} table with {fields_count} fields')
            tables.add(table_name)

            item_count = random.randint(10, 100)
            for _ in range(item_count):
                try:
                    item = {}
                    for field in definitions:
                        if field['AttributeType'] == 'S':
                            item[field['AttributeName']] = {'S': f.word()}
                        elif field['AttributeType'] == 'N':
                            item[field['AttributeName']] = {'N': str(random.randint(0, 123123213))}

                    client.put_item(TableName=table_name, Item=item)

                except:
                    raise
                
            logging.info(f'Successfully created {table_name} table with {item_count} items')
        except:
            raise


