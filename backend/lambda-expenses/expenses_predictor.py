import boto3
import csv
from io import BytesIO
from datetime import datetime
from collections import defaultdict
import pandas as pd
import joblib

def predict_expenses(s3_client, data, model_bucket):
    """
    Predict expenses using a pre-trained model.
    
    Args:
        data: DataFrame with expense data
    
    Returns:
        list: Predicted expenses with predicted labels
    """
    def load_joblib(bucket, key):
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return joblib.load(BytesIO(obj['Body'].read()))

    model = load_joblib(model_bucket, 'expenses_predictor_model.joblib')

    snapshot_df = process_expense_data_snapshots(data) #, custom_snapshot_day=current_day

    if snapshot_df.empty:
        return {
            'expensesPerDayCurrentMonth': [],
            'finalMonthPrediction': 0.0
        }

    if 'target_total_expenses' in snapshot_df.columns:
        snapshot_df = snapshot_df.drop(columns=['target_total_expenses'])

    final_prediction = float(model.predict(snapshot_df)[0])

    all_expenses = data.to_dict(orient='records')
    current_month_expenses = get_current_month_expenses(all_expenses)

    return {
        'expensesPerDayCurrentMonth': current_month_expenses,
        'finalMonthPrediction': round(final_prediction, 2)
    }

def get_current_month_expenses(all_expenses):
    """
    Process expenses for the current month and calculate cumulative totals per day.
    
    Returns:
        list: Daily expense totals for the current month
    """
    # Get current date
    today = datetime.now()
    current_month = today.month
    current_year = today.year
    
    # Filter expenses for current month
    current_month_expenses = [
        expense for expense in all_expenses
        if expense['date'].month == current_month
        and expense['date'].year == current_year
        and expense['date'].date() <= today.date()
    ]
    
    # Group expenses by day
    daily_totals = defaultdict(float)
    for expense in current_month_expenses:
        day = expense['date'].day
        daily_totals[day] += expense['amount']
    
    # Calculate cumulative totals
    result = []
    cumulative_total = 0
    
    # Get all days from 1 to today
    current_day = today.day
    for day in range(1, current_day + 1):
        cumulative_total += daily_totals[day]
        result.append({
            'day': day,
            'totalMonthExpensesTillToday': round(cumulative_total, 2)
        })
    
    return result

def process_expense_data_snapshots(df):
    df['amount'] = df['amount'].astype(float)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date'])  # Drop invalid dates

    df['day'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    df['year'] = df['date'].dt.year

    df = df.drop(['category', 'description/merchant'], axis=1)

    if 'expense_type' in df.columns:
        df = df.drop(columns=['expense_type'])

    today = datetime.now()
    current_year = today.year
    current_month = today.month
    current_day = today.day
    expensive_threshold = 100

    this_month_df = df[
        (df['year'] == current_year) &
        (df['month'] == current_month) &
        (df['day'] <= current_day)
    ]

    if this_month_df.empty:
        return pd.DataFrame()

    snapshot = {
        'year': current_year,
        'month': current_month,
        'day': current_day,
        'total_so_far': this_month_df['amount'].sum(),
        'avg_daily_so_far': this_month_df['amount'].sum() / current_day,
        'num_expensive_transactions': (this_month_df['amount'] > expensive_threshold).sum(),
        'num_transactions': this_month_df.shape[0]
    }

    # Convert to DataFrame and round
    snapshot_df = pd.DataFrame([snapshot])
    snapshot_df[['total_so_far', 'avg_daily_so_far']] = snapshot_df[['total_so_far', 'avg_daily_so_far']].round(2)

    return snapshot_df