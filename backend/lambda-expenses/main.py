import json
import boto3
import datetime
from expense_processor import get_current_month_expenses

def lambda_handler(event, context):
    """
    AWS Lambda handler function to process expense data and return monthly expense prediction.
    
    Args:
        event (dict): AWS Lambda event data
        context (object): AWS Lambda context
        
    Returns:
        dict: API Gateway response with expense prediction data
    """
    try:
        # Get expenses data for current month
        expenses_data = get_current_month_expenses()
        
        # Return the result
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'expensesPerDayCurrentMonth': expenses_data
            })
        }
    except Exception as e:
        print(f"Error processing expense data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': f'Failed to process expense data: {str(e)}'
            })
        }