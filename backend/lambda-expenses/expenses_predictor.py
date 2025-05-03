import boto3
import csv
from io import BytesIO
import datetime
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
    #---------------------------------------------------- 
      # ⏱️ Current date info
    today = datetime.now()
    current_day = today.day

    # 📊 Generate snapshot just for today
    snapshot_df = process_expense_data_snapshots(data, custom_snapshot_day=current_day)

    # 🛑 No data? Avoid crash
    if snapshot_df.empty:
        return {
            'expensesPerDayCurrentMonth': [],
            'finalMonthPrediction': 0.0
        }

    # 🧮 Drop training-only column
    if 'target_total_expenses' in snapshot_df.columns:
        snapshot_df = snapshot_df.drop(columns=['target_total_expenses'])

    # 🔮 Predict
    final_prediction = float(model.predict(snapshot_df)[0])

    all_expenses = data.to_dict(orient='records')
    current_month_expenses = get_current_month_expenses(all_expenses)

    # Return the complete response
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

    # 🧹 Clean & prepare
    df['amount'] = df['amount'].astype(float)
    df['day'] = df['date'].dt.day
    df['month'] = df['date'].dt.month
    df['year'] = df['date'].dt.year

    #ALERT Maybe bug here if expense_type does not exist
    df = df.drop(['category', 'description/merchant', 'expense_type'], axis=1)

    # 🚀 Parameters
    snapshot_days = [5, 10, 15, 20, 25, 28]
    expensive_threshold = 100

    # 🛠️ Function to generate features for each snapshot
    def generate_snapshots(df, snapshot_days):
        all_snapshots = []

        grouped = df.groupby(['year', 'month'])
        for (year, month), group in grouped:
            full_month_total = group['amount'].sum()

            for day_cutoff in snapshot_days:
                partial = group[group['day'] <= day_cutoff]
                if partial.empty:
                    continue

                snapshot = {
                    'year': year,
                    'month': month,
                    'day': day_cutoff,
                    'total_so_far': partial['amount'].sum(),
                    'avg_daily_so_far': partial['amount'].sum() / day_cutoff,
                    'num_expensive_transactions': (partial['amount'] > expensive_threshold).sum(),
                    'num_transactions': partial.shape[0],
                    'target_total_expenses': full_month_total
                }
                all_snapshots.append(snapshot)

        return pd.DataFrame(all_snapshots)

    # ⚙️ Generate feature dataset
    data = generate_snapshots(df, snapshot_days)

    # 🎯 Round financial values to 2 decimals
    data[['total_so_far', 'avg_daily_so_far', 'target_total_expenses']] = data[['total_so_far', 'avg_daily_so_far', 'target_total_expenses']].round(2)   

    return data