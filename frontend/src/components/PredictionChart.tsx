import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

// TypeScript interfaces for the data structures
interface ExpensePoint {
  day: number;
  totalMonthExpensesTillToday: number;
}

interface BackendData {
  expensesPerDayCurrentMonth: ExpensePoint[];
  finalMonthPrediction: number;
}

interface ChartDataPoint {
  day: number;
  actual: number | null;
  predicted: number | null;
}

// Sample data for demonstration (this would come from your API)
const SAMPLE_DATA: BackendData = {
  expensesPerDayCurrentMonth: [
    { day: 1, totalMonthExpensesTillToday: 10 },
    { day: 2, totalMonthExpensesTillToday: 25 },
    { day: 3, totalMonthExpensesTillToday: 35 },
    { day: 4, totalMonthExpensesTillToday: 40 },
    { day: 5, totalMonthExpensesTillToday: 55 },
    { day: 6, totalMonthExpensesTillToday: 65 },
    { day: 7, totalMonthExpensesTillToday: 75 },
    { day: 8, totalMonthExpensesTillToday: 85 },
    { day: 9, totalMonthExpensesTillToday: 95 },
  ],
  finalMonthPrediction: 400,
};

interface SpendingPredictionChartProps {
  data?: BackendData;
}

export default function SpendingPredictionChart({
  data = SAMPLE_DATA,
}: SpendingPredictionChartProps): React.ReactElement {
  // Function to get the number of days in a specific month
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function generateChartData(data: BackendData): ChartDataPoint[] {
    const { expensesPerDayCurrentMonth, finalMonthPrediction } = data;

    // Get the last actual data point
    const lastActualPoint =
      expensesPerDayCurrentMonth[expensesPerDayCurrentMonth.length - 1];
    if (!lastActualPoint) {
      return [];
    }

    const lastDay = lastActualPoint.day;
    const lastValue = lastActualPoint.totalMonthExpensesTillToday;

    // Get current date to determine the month and year
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Get the number of days in the current month
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);

    // Calculate remaining days
    const remainingDays = daysInMonth - lastDay;
    if (remainingDays <= 0) {
      return expensesPerDayCurrentMonth.map((point) => ({
        day: point.day,
        actual: point.totalMonthExpensesTillToday,
        predicted: null,
      }));
    }

    // Convert actual data (all except the last point)
    const actualData: ChartDataPoint[] = expensesPerDayCurrentMonth
      .slice(0, -1)
      .map((point) => ({
        day: point.day,
        actual: point.totalMonthExpensesTillToday,
        predicted: null,
      }));

    // The last actual point will have both actual and predicted values
    // This is the key to connecting the lines smoothly
    actualData.push({
      day: lastDay,
      actual: lastValue,
      predicted: lastValue,
    });

    const valueToAdd = finalMonthPrediction - lastValue;

    // Create prediction data points (starting after the overlap point)
    const predictedData: ChartDataPoint[] = [];

    for (let i = 1; i <= remainingDays; i++) {
      const progress = i / remainingDays;
      // Simple linear progression with a bit of randomization
      const randomFactor = Math.random() * 0.1; // Random factor between 0 and 5%
      const dayValue = lastValue + valueToAdd * progress * (1 + randomFactor);

      predictedData.push({
        day: lastDay + i,
        actual: null,
        predicted: Math.round(dayValue),
      });
    }

    // Ensure final prediction is exact
    if (predictedData.length > 0) {
      predictedData[predictedData.length - 1].predicted = finalMonthPrediction;
    }

    // Combine both datasets
    return [...actualData, ...predictedData];
  }

  const chartData = generateChartData(data);

  // Get the last actual day
  const lastActualDay =
    data.expensesPerDayCurrentMonth.length > 0
      ? data.expensesPerDayCurrentMonth[
          data.expensesPerDayCurrentMonth.length - 1
        ].day
      : 1;

  // Get current date to determine the month and year
  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid
          vertical={false}
          horizontal
          stroke="#fff"
          strokeOpacity={"20%"}
        />
        <ReferenceLine x={daysInMonth} stroke="#fff" strokeOpacity={"20%"} />
        <XAxis
          dataKey="day"
          domain={[1, daysInMonth]}
          ticks={[lastActualDay, daysInMonth]}
          tickFormatter={(tick) =>
            tick === lastActualDay ? "Today" : "Month end"
          }
          stroke="#f1f1f1"
        />
        <YAxis
          stroke="#f1f1f1"
          tick={{ fontSize: 12}}
          label={{ value: "EUR", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          labelFormatter={(label) =>
            label === lastActualDay ? "Today" : `Day ${label}`
          } 
          contentStyle={{
            backgroundColor: "#1F2937",
            border: "none",
            borderRadius: "0.5rem",
          }}
          itemStyle={{ color: "#F3F4F6" }}
          labelStyle={{ color: "#F3F4F6", fontWeight: "bold" }}
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#FFF"
          strokeWidth={2}
          name="Expenses"
          connectNulls={true}
          dot={<CustomizedDot data={chartData} />}
        />
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#fff"
          strokeWidth={2}
          dot={false}
          strokeOpacity={0.5}
          strokeDasharray="2 2"
          name="Prediction"
          connectNulls={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const CustomizedDot = (props: any) => {
  const { cx, cy, index, data } = props;
  // Solo muestra el dot en el último punto con valor `actual`
  const isLastActual = index === data.findLastIndex((d: ChartDataPoint) => d.actual !== null);
  if (!isLastActual) return null;

  return (
    <circle fill="#fff" cx={cx} cy={cy} r={6} />
  );
};
