import json
import boto3
import joblib
import warnings
import numpy as np
import pandas as pd
from io import BytesIO, StringIO
from sklearn.preprocessing import LabelEncoder, StandardScaler

def preprocess_expense_df_inference(df, feature_cols, encoders=None, scaler=None):
    """
    Preprocess expense data for inference (prediction) without target column handling.
    
    Args:
        df: DataFrame with expense data
        feature_cols: List of feature column names to use
        encoders: Dict of pre-fitted label encoders (optional)
        scaler: Pre-fitted StandardScaler (optional)
        
    Returns:
        X: Preprocessed feature matrix
        used_cols: Final column names used
        new_encoders: Dict of fitted encoders (only if encoders=None)
        new_scaler: Fitted scaler (only if scaler=None and scaling performed)
    """
    df = df.copy()
    new_encoders = {} if encoders is None else None
    new_scaler = None
    
    # Date → DayOfWeek
    if 'date' in feature_cols:
        original_date_col = df['date'].copy()
        try:
            df['date_dt'] = pd.to_datetime(df['date'], format='%Y-%m-%d', errors='raise')
            df['DayOfWeek'] = df['date_dt'].dt.dayofweek
        except ValueError:
            df['date_dt'] = pd.to_datetime(df['date'], format='%d/%m/%Y', errors='coerce')
            df['DayOfWeek'] = df['date_dt'].dt.dayofweek

        if df['DayOfWeek'].isnull().any():
            nan_dates = original_date_col[df['DayOfWeek'].isnull()]
            if not nan_dates.empty:
                warnings.warn(f"Could not determine day of week for: {nan_dates.unique().tolist()}")
    
    # Categorical Encoding
    for col in ['category', 'description/merchant']:
        if col in feature_cols:
            df[col] = df[col].fillna('Missing')
            
            if encoders is not None and col in encoders:
                # Use provided encoder - handle unseen categories
                le = encoders[col]
                try:
                    df[col + '_enc'] = le.transform(df[col])
                except ValueError:
                    # Handle unseen categories
                    unseen_mask = ~df[col].isin(le.classes_)
                    if unseen_mask.any():
                        warnings.warn(f"Found {unseen_mask.sum()} unseen categories in {col}")
                    # For unseen categories, use most frequent class (0)
                    df.loc[unseen_mask, col + '_enc'] = 0
                    df.loc[~unseen_mask, col + '_enc'] = le.transform(df.loc[~unseen_mask, col])
            else:
                # Create new encoder
                le = LabelEncoder()
                df[col + '_enc'] = le.fit_transform(df[col])
                if new_encoders is not None:
                    new_encoders[col] = le

    # Map features → transformed names
    feature_map = {}
    if 'date' in feature_cols:
        feature_map['date'] = 'DayOfWeek'
    for col in ['category', 'description/merchant']:
        if col in feature_cols:
            feature_map[col] = col + '_enc'

    # Build final X columns
    X_cols_final = []
    for col in feature_cols:
        if col not in feature_map:
            if not pd.api.types.is_numeric_dtype(df[col]):
                df[col] = pd.to_numeric(df[col], errors='coerce')
        if col in feature_map:
            X_cols_final.append(feature_map[col])
        else:
            X_cols_final.append(col)
    X_cols_final = [c for c in X_cols_final if c in df.columns]

    # Ensure numeric features
    for col in X_cols_final:
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Drop NaNs to ensure clean data for prediction
    df.dropna(subset=X_cols_final, inplace=True)

    # Get feature matrix
    X = df[X_cols_final].values
    
    # Apply scaling if scaler provided
    if scaler is not None and X.size > 0:
        X = scaler.transform(X)
    elif scaler is None and X.size > 0:
        new_scaler = StandardScaler()
        X = new_scaler.fit_transform(X)
        
    return X, X_cols_final, new_encoders, new_scaler

def handler(event, context):
    AWS_ACCESS_KEY_ID     = ""
    AWS_SECRET_ACCESS_KEY = ""
    MODEL_BUCKET = 'expenses-classifier-model'
    DATA_BUCKET  = 'datasets-expenses'
    CSV_KEY    = 'expenses.csv'

    # Create S3 client with explicit creds
    session = boto3.Session(
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )
    s3 = session.client('s3')

    def load_joblib(bucket, key):
        obj = s3.get_object(Bucket=bucket, Key=key)
        return joblib.load(BytesIO(obj['Body'].read()))

    # Load artifacts
    model        = load_joblib(MODEL_BUCKET, 'expense_classifier_model.joblib')
    scaler       = load_joblib(MODEL_BUCKET, 'expense_scaler.joblib')
    target_le    = load_joblib(MODEL_BUCKET, 'expense_target_label_encoder.joblib')
    category_le  = load_joblib(MODEL_BUCKET, 'expense_category_label_encoder.joblib')
    merchant_le  = load_joblib(MODEL_BUCKET, 'expense_merchant_label_encoder.joblib')

    label_encoders = {
        'category': category_le,
        'description/merchant': merchant_le
    }
    
    try:
        # Fetch data
        data_obj = s3.get_object(Bucket=DATA_BUCKET, Key=CSV_KEY)
        df = pd.read_csv(BytesIO(data_obj['Body'].read()))

        # Preprocess
        feature_cols = ['amount', 'date', 'category', 'description/merchant']
        
        # Then pass this to preprocessing
        valid_idx = df.dropna(subset=feature_cols).index
        X, used_cols, _, _ = preprocess_expense_df_inference(
            df.loc[valid_idx],
            feature_cols,
            encoders=label_encoders,
            scaler=scaler
        )

        # Predict
        preds_numeric = model.predict(X)

        # Inverse-transform
        preds_label = target_le.inverse_transform(preds_numeric)

        # Write back only to those rows
        df.loc[valid_idx, 'predicted_expense_type'] = preds_label

        # Upload reviewed CSV
        out_buf = StringIO()
        df.to_csv(out_buf, index=False)
        s3.put_object(Bucket=DATA_BUCKET, Key=CSV_KEY, Body=out_buf.getvalue())
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Success: uploaded s3://{DATA_BUCKET}/{CSV_KEY}',
                'predictions_count': len(preds_numeric)
            })
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    
if __name__ == "__main__":
    # Create a mock event
    mock_event = {
        "test": "event"
    }

# Create a mock context (simplified)
class MockContext:
    function_name = "test_function"
    memory_limit_in_mb = 128
    aws_request_id = "test_request_id"

mock_context = MockContext()

# Call your handler
result = handler(mock_event, mock_context)
print("Lambda Result:", result)