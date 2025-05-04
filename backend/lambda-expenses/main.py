from expenses_classifier import classify_expenses
from expenses_predictor import predict_expenses
from utils import error_handler, response_creator, create_s3_client, get_csv_data

AWS_ACCESS_KEY_ID     = ""
AWS_SECRET_ACCESS_KEY = ""
CLASSIFIER_MODEL_BUCKET = 'expenses-classifier-model'
PREDICTOR_MODEL_BUCKET = 'expenses-predictor-model'
DATA_BUCKET  = 'datasets-expenses'
CSV_DATA    = 'expenses.csv'

def handler(event, context):
    """
    AWS Lambda handler function to process expense data and return monthly expense prediction.
    
    Args:
        event (dict): AWS Lambda event data
        context (object): AWS Lambda context
        
    Returns:
        dict: API Gateway response with expense prediction data
    """
    if event.get("httpMethod") == "OPTIONS":
        return response_creator(200, "OK")

    action = event.get('queryStringParameters', {}).get('action', '')

    if action != 'classify-expenses' and action != 'predict-expenses':
        return response_creator(400, "Invalid action specified.")

    try: 
        s3_client = create_s3_client()
    except Exception as e:
        error_handler(e, "Failed to create S3 client")
        return
    
    try:
        data = get_csv_data(s3_client, DATA_BUCKET, CSV_DATA)
    except Exception as e:
        error_handler(e, "Failed to get CSV data")
        return
    
    if action == 'classify-expenses':
        try:
            classified_expenses = classify_expenses(s3_client, data, CLASSIFIER_MODEL_BUCKET, DATA_BUCKET, CSV_DATA)
            return response_creator(200, classified_expenses)
        except Exception as e:
            error_handler(e, "Failed to classify expenses")
            return
    elif action == 'predict-expenses':
        try:
            predicted_expenses = predict_expenses(s3_client, data, PREDICTOR_MODEL_BUCKET)
            return response_creator(200, predicted_expenses)
        except Exception as e:
            error_handler(e, "Failed to predict expenses")
            return  


   