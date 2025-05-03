import json
import boto3
import joblib
import warnings
import numpy as np
import pandas as pd
from io import BytesIO, StringIO
from sklearn.preprocessing import LabelEncoder, StandardScaler

def preprocess_expense_df(df, feature_cols, target_col="expense_type", normalize=False):
    df = df.copy()
    le_target = LabelEncoder()
    scaler = None

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
    else:
        df['DayOfWeek'] = np.nan

    # Categorical Encoding
    encoders = {}
    for col in ['category', 'description/merchant']:
        if col in feature_cols:
            df[col] = df[col].fillna('Missing')
            le = LabelEncoder()
            df[col + '_enc'] = le.fit_transform(df[col])
            encoders[col] = le

    # Target encoding
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not in DataFrame.")
    df[target_col] = df[target_col].fillna('Missing')
    df[target_col + '_enc'] = le_target.fit_transform(df[target_col])

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
        if col not in feature_map and col != target_col:
            if not pd.api.types.is_numeric_dtype(df[col]):
                df[col] = pd.to_numeric(df[col], errors='coerce')
        if col in feature_map:
            X_cols_final.append(feature_map[col])
        elif col != target_col:
            X_cols_final.append(col)
    X_cols_final = [c for c in X_cols_final if c in df.columns]

    # Drop NaNs
    y_col = target_col + '_enc'
    df.dropna(subset=X_cols_final + [y_col], inplace=True)

    X = df[X_cols_final].values
    y = df[y_col].values

    if normalize:
        if X.size > 0:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)
        else:
            warnings.warn("Skipping normalization because X is empty.")

    return X, y, le_target, X_cols_final, scaler

def handler(event, context):
    AWS_ACCESS_KEY_ID     = ""
    AWS_SECRET_ACCESS_KEY = ""
    MODEL_BUCKET = 'expenses-classifier-model'
    DATA_BUCKET  = 'datasets-expenses'
    MODEL_KEY    = 'expense_classifier_model.joblib'
    SCALER_KEY   = 'expense_scaler.joblib'
    ENCODER_KEY  = 'expense_label_encoder.joblib'
    INPUT_KEY    = 'clean_expenses.csv'
    OUTPUT_KEY   = 'reviewed_expenses.csv'

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
    model = load_joblib(MODEL_BUCKET, MODEL_KEY)
    try:
        scaler = load_joblib(MODEL_BUCKET, SCALER_KEY)
    except Exception:
        scaler = None
    label_encoder = load_joblib(MODEL_BUCKET, ENCODER_KEY)

    
    try:
        # Fetch data
        data_obj = s3.get_object(Bucket=DATA_BUCKET, Key=INPUT_KEY)
        df = pd.read_csv(BytesIO(data_obj['Body'].read()))

        # Preprocess
        feature_columns = [c for c in df.columns if c != 'expense_type']
        X, _, _, used_cols, _ = preprocess_expense_df(df, feature_columns, target_col='expense_type', normalize=False)

        # If scaler exists, apply the same normalization
        if scaler is not None:
            X = scaler.transform(X)

        # Predict
        y_enc = model.predict(X)
        y = label_encoder.inverse_transform(y_enc)
        df['predicted_expense_type'] = y

        # Upload reviewed CSV
        out_buf = StringIO()
        df.to_csv(out_buf, index=False)
        s3.put_object(Bucket=MODEL_BUCKET, Key=OUTPUT_KEY, Body=out_buf.getvalue())
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': f'Success: uploaded s3://{MODEL_BUCKET}/{OUTPUT_KEY}'})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
