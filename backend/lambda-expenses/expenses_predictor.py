import boto3
import csv
import io
import datetime
from collections import defaultdict
import pandas as pd

def get_s3_file(bucket_name='expense-data-bucket', file_key='clean_expenses.csv'):
    """
    Fetch a CSV file from an S3 bucket.
    
    Args:
        bucket_name (str): S3 bucket name
        file_key (str): File key in the S3 bucket
        
    Returns:
        str: CSV content as a string
    """
    s3_client = boto3.client('s3')
    response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
    return response['Body'].read().decode('utf-8')

def parse_expenses(csv_content):
    """
    Parse CSV content and extract expense records.
    
    Args:
        csv_content (str): CSV content as a string
        
    Returns:
        list: List of dictionaries containing expense data
    """
    expenses = []
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    for row in csv_reader:
        try:
            expense = {
                'amount': float(row['amount']),
                'date': row['date'],
                'category': row['category'],
                'description': row['description/merchant'],
                'expense_type': row['expense_type']
            }
            expenses.append(expense)
        except (ValueError, KeyError) as e:
            print(f"Error parsing row: {row}, Error: {str(e)}")
    
    return expenses

def get_current_month_expenses():
    """
    Process expenses for the current month and calculate cumulative totals per day.
    
    Returns:
        list: Daily expense totals for the current month
    """
    # Get current date
    today = datetime.datetime.now()
    current_month = today.month
    current_year = today.year
    
    # Fetch and parse expense data
    csv_content = get_s3_file()
    all_expenses = parse_expenses(csv_content)
    
    # Filter expenses for current month
    current_month_expenses = [
        expense for expense in all_expenses
        if datetime.datetime.strptime(expense['date'], '%Y-%m-%d').month == current_month
        and datetime.datetime.strptime(expense['date'], '%Y-%m-%d').year == current_year
        and datetime.datetime.strptime(expense['date'], '%Y-%m-%d').date() <= today.date()
    ]
    
    # Group expenses by day
    daily_totals = defaultdict(float)
    for expense in current_month_expenses:
        expense_date = datetime.datetime.strptime(expense['date'], '%Y-%m-%d')
        day = expense_date.day
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

#List[Dict[str, Any]]
def process_expense_data_snapshots(expenses):
    df = pd.DataFrame(expenses) 

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