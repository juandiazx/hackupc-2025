import json
import boto3
import pandas as pd
from io import BytesIO

s3_client = None

def response_creator(status_code, body):
    """
    Create a formatted response for API Gateway.
    
    Args:
        statusCode (int): HTTP status code
        body (dict): Response body content
    
    Returns:
        dict: Formatted API Gateway response
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        },
        "body": json.dumps(body) if not isinstance(body, str) else body
    }

def error_handler(e, message=None):
    """
    Handle errors and return a formatted error message.
    """
    error_msg = f"{message}: {str(e)}" if message else str(e)
    print(f"Error: {error_msg}")
    return response_creator(500, {
        'error': error_msg
    })

def create_s3_client():
    """
    Create an S3 client using boto3.
    
    Returns:
        boto3.client: S3 client instance
    """
    global s3_client
    if s3_client is None:
        s3_client = boto3.client('s3')
    return s3_client

def get_csv_data(s3_client, bucket_name, file_key):
    """
    Fetch a CSV file from an S3 bucket.
    
    Args:
        s3_client (boto3.client): S3 client instance
        bucket_name (str): S3 bucket name
        file_key (str): File key in the S3 bucket
    
    Returns:
        str: CSV content as a string
    """
    response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
    return pd.read_csv(BytesIO(response['Body'].read()))

