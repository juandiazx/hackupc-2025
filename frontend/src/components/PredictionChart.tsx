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

// Nuevo tipo de datos
export type EndMonthExpensePrediction = {
  expensesPerDayCurrentMonth: { day: number; totalMonthExpensesTillToday: number }[];
  finalMonthPrediction: number;
};

interface ChartDataPoint {
  day: number;
  actual: number | null;
  predicted: number | null;
}

interface SpendingPredictionChartProps {
  data?: EndMonthExpensePrediction;
}

export default function SpendingPredictionChart({
  data,
}: SpendingPredictionChartProps): React.ReactElement {
  // Función para obtener el número de días en un mes
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function generateChartData(data: EndMonthExpensePrediction): ChartDataPoint[] {
    const { expensesPerDayCurrentMonth, finalMonthPrediction } = data;

    // Obtener el último punto real de gastos
    const lastActualPoint = expensesPerDayCurrentMonth[expensesPerDayCurrentMonth.length - 1];
    if (!lastActualPoint) {
      return [];
    }

    const lastDay = lastActualPoint.day;
    const lastValue = lastActualPoint.totalMonthExpensesTillToday;

    // Obtener la fecha actual para determinar el mes y el año
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Obtener el número de días en el mes actual
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);

    // Calcular los días restantes
    const remainingDays = daysInMonth - lastDay;
    if (remainingDays <= 0) {
      return expensesPerDayCurrentMonth.map((point) => ({
        day: point.day,
        actual: point.totalMonthExpensesTillToday,
        predicted: null,
      }));
    }

    // Convertir los datos reales (todos excepto el último punto)
    const actualData: ChartDataPoint[] = expensesPerDayCurrentMonth
      .slice(0, -1)
      .map((point) => ({
        day: point.day,
        actual: point.totalMonthExpensesTillToday,
        predicted: null,
      }));

    // El último punto real tendrá tanto valores reales como predicciones
    actualData.push({
      day: lastDay,
      actual: lastValue,
      predicted: lastValue,
    });

    const valueToAdd = finalMonthPrediction - lastValue;

    // Crear los puntos de datos de predicción (empezando después del punto de superposición)
    const predictedData: ChartDataPoint[] = [];

    for (let i = 1; i <= remainingDays; i++) {
      const progress = i / remainingDays;
      // Progresión lineal con algo de aleatorización
      const randomFactor = Math.random() * 0.1; // Factor aleatorio entre 0 y 10%
      const dayValue = lastValue + valueToAdd * progress * (1 + randomFactor);

      predictedData.push({
        day: lastDay + i,
        actual: null,
        predicted: Math.round(dayValue),
      });
    }

    // Asegurarse de que la última predicción sea exacta
    if (predictedData.length > 0) {
      predictedData[predictedData.length - 1].predicted = finalMonthPrediction;
    }

    // Combinar ambos conjuntos de datos
    return [...actualData, ...predictedData];
  }

  // Generamos los datos para el gráfico
  const chartData = data ? generateChartData(data) : [];

  // Obtener el último día real de gastos
  const lastActualDay =
    (data?.expensesPerDayCurrentMonth ?? []).length > 0
      ? data?.expensesPerDayCurrentMonth[data.expensesPerDayCurrentMonth.length - 1]?.day ?? 1
      : 1;

  // Obtener la fecha actual para determinar el mes y el año
  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth());

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} horizontal stroke="#fff" strokeOpacity={"20%"} />
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
        <YAxis stroke="#f1f1f1" tick={{ fontSize: 12 }} label={{ value: "EUR", angle: -90, position: "insideLeft" }} />
        <Tooltip
          labelFormatter={(label) => (label === lastActualDay ? "Today" : `Day ${label}`)}
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

  return <circle fill="#fff" cx={cx} cy={cy} r={6} />;
};
