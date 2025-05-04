export type MonthlyExpensesReport = {
  expenses: {
      amount: number;
      date: Date;
      category: string;
      description: string;
      want: boolean;
    }[],
  wants: number,
  needs: number,
};

export type EndMonthExpensePrediction = {
  expensesPerDayCurrentMonth: [
    { day: number; totalMonthExpensesTillToday: number }
  ],
  finalMonthPrediction: number
};