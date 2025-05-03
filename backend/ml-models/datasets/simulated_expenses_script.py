import pandas as pd
import random
from datetime import datetime, timedelta

# --- Configuración ---
start_date = datetime(2023, 5, 1)
end_date = datetime(2025, 5, 4)

categories_merchants = {
    "Groceries": ["Local Supermarket", "Supermarket A", "Grocery Store B"],
    "Dining Out": ["Coffee Shop Downtown", "Lunch Cafe", "Fast Food Z", "Pizzeria Bella", "Sushi Bar"],
    "Shopping": ["Clothing Store Sale", "Bookshop", "Online Electronics", "Home Decor"],
    "Transportation": ["Petrol Station", "Bus Pass Kiosk", "Ride Sharing App"],
    "Entertainment": ["Cinema Tickets", "Streaming Service Subscription", "Concert Venue"],
    "Utilities": ["Electricity Bill", "Water Bill", "Internet Provider"],
    "Personal Care": ["Haircut", "Spa Center", "Pharmacy"],
    "Health": ["Gym Membership", "Doctor Visit", "Therapy Session"],
    "Travel": ["Flight Booking", "Hotel Stay", "Train Ticket"],
    "Education": ["Online Course", "Bookstore", "Workshop Fee"]
}

amount_ranges = {
    "Groceries": (20, 120),
    "Dining Out": (5, 40),
    "Shopping": (10, 200),
    "Transportation": (10, 60),
    "Entertainment": (10, 100),
    "Utilities": (30, 150),
    "Personal Care": (5, 80),
    "Health": (20, 150),
    "Travel": (50, 500),
    "Education": (15, 250)
}

def classify_expense(category, merchant):
    # Default rules
    need_categories = {"Groceries", "Transportation", "Utilities", "Personal Care", "Health"}
    want_categories = {"Dining Out", "Shopping", "Entertainment", "Travel"}

    # Fine-grained rules
    if category == "Education":
        if merchant in {"Online Course", "Workshop Fee"}:
            return "need"
        if merchant == "Bookstore":
            return "want"  # leisure books, not mandatory

    if category == "Shopping":
        if merchant == "Bookshop":
            return "want"  # assumed leisure shopping
        if merchant == "Online Electronics":
            return "want"
        if merchant == "Clothing Store Sale":
            return "need"  # basic clothing needs
        if merchant == "Home Decor":
            return "want"

    if category == "Personal Care":
        if merchant == "Pharmacy":
            return "need"
        else:
            return "want"

    if category == "Health":
        return "need"  # All health-related expenses are essential

    if category == "Entertainment":
        if merchant == "Streaming Service Subscription":
            return "want"
        else:
            return "want"

    if category == "Dining Out":
        return "want"

    if category == "Groceries":
        return "need"

    if category == "Transportation":
        return "need"

    if category == "Utilities":
        return "need"

    if category == "Travel":
        return "want"

    # Fallback
    return "want" if category in want_categories else "need"

def generate_expenses():
    current_date = start_date
    rows = []

    while current_date <= end_date:
        num_transactions = 0

        if current_date.weekday() in [5, 6]:  # sábado, domingo
            num_transactions = random.randint(1, 5)
        elif current_date.day in [1, 15, 30]:
            num_transactions = random.randint(2, 6)
        else:
            num_transactions = random.choices([0, 1, 2, 3], weights=[0.2, 0.3, 0.3, 0.2])[0]

        for _ in range(num_transactions):
            category = random.choice(list(categories_merchants.keys()))
            merchant = random.choice(categories_merchants[category])
            amount = round(random.uniform(*amount_ranges[category]), 2)
            expense_type = classify_expense(category, merchant)

            rows.append({
                "amount": amount,
                "date": current_date.strftime("%Y-%m-%d"),
                "category": category,
                "description/merchant": merchant,
                "expense_type": expense_type
            })

        current_date += timedelta(days=1)

    return pd.DataFrame(rows)

# --- Ejecutar ---
df = generate_expenses()
df.to_csv("gastos_simulados.csv", index=False)
print("✅ Archivo generado: gastos_simulados.csv")
