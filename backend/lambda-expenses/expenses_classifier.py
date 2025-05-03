import json
import boto3
import joblib
import warnings
import numpy as np
import pandas as pd
from io import BytesIO, StringIO
from sklearn.preprocessing import LabelEncoder, StandardScaler

FEATURE_COLS = ['amount', 'date', 'category', 'description/merchant']

def classify_expenses(s3_client, data, model_bucket, data_bucket, output_key=None):
    """
    Classify expenses using a pre-trained model.
    
    Args:
        data: DataFrame with expense data
    
    Returns:
        list: Classified expenses with predicted labels
    """
    def load_joblib(bucket, key):
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return joblib.load(BytesIO(obj['Body'].read()))
    
    model        = load_joblib(model_bucket, 'expense_classifier_model.joblib')
    scaler       = load_joblib(model_bucket, 'expense_scaler.joblib')
    target_le    = load_joblib(model_bucket, 'expense_target_label_encoder.joblib')
    category_le  = load_joblib(model_bucket, 'expense_category_label_encoder.joblib')
    merchant_le  = load_joblib(model_bucket, 'expense_merchant_label_encoder.joblib')

    label_encoders = {
        'category': category_le,
        'description/merchant': merchant_le
    }

    valid_idx = data.dropna(subset=FEATURE_COLS).index
    X, used_cols, _, _ = preprocess_expense_df_inference(
        data.loc[valid_idx],
        FEATURE_COLS,
        encoders=label_encoders,
        scaler=scaler
    )

    # Predict
    preds_numeric = model.predict(X)

    # Inverse-transform
    preds_label = target_le.inverse_transform(preds_numeric)

    # Write back only to those rows
    data.loc[valid_idx, 'predicted_expense_type'] = preds_label

    # Upload the modified DataFrame with predictions if output_key is provided
    if output_key:
        out_buf = StringIO()
        data.to_csv(out_buf, index=False)
        s3_client.put_object(Bucket=data_bucket, Key=output_key, Body=out_buf.getvalue())

    # return classified expenses as well as the percentage of wants and needs
    wants_percentage, needs_percentage = get_wants_and_needs_percentages(data)
    expense_details = []
    for _, row in data.iterrows():
        if pd.notna(row.get('predicted_expense_type')):
            expense_details.append({
                'amount': float(row['amount']),
                'date': row['date'],
                'category': row['category'],
                'description': row['description/merchant'],
                'want': row['predicted_expense_type'] == 'want'
            })
    
    # Return the complete response
    return {
        'wants': wants_percentage,
        'needs': needs_percentage,
        'expenses': expense_details
    }

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

    X = df[X_cols_final].values
    
    # Apply scaling if scaler provided
    if scaler is not None and X.size > 0:
        X = scaler.transform(X)
    elif scaler is None and X.size > 0:
        new_scaler = StandardScaler()
        X = new_scaler.fit_transform(X)
        
    return X, X_cols_final, new_encoders, new_scaler

def get_wants_and_needs_percentages(classified_expenses):
    """
    Calculate the percentage of wants and needs in classified expenses.
    
    Args:
        classified_expenses: DataFrame with classified expenses
    
    Returns:
        dict: Percentages of wants and needs
    """
    total_expenses = len(classified_expenses)
    if total_expenses == 0:
        return {'wants_percentage': 0, 'needs_percentage': 0}
    
    wants_count = classified_expenses[classified_expenses['predicted_expense_type'] == 'want'].shape[0]
    needs_count = classified_expenses[classified_expenses['predicted_expense_type'] == 'need'].shape[0]
    
    wants_percentage = (wants_count / total_expenses) * 100
    needs_percentage = (needs_count / total_expenses) * 100
    
    return (round(wants_percentage, 2),round(needs_percentage, 2))
