import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Legend, LegendProps } from "recharts";
import { MonthlyExpensesReport } from "../types/types";

const COLORS = ["#5F7CFA", "#FF5959"];

type HalfPieChartProps = {
  wants: MonthlyExpensesReport["wants"];
  needs: MonthlyExpensesReport["needs"];
};

export default function HalfPieChart({ wants, needs }: HalfPieChartProps) {
  const data = [
    { name: "Wants", value: wants, percentage: wants },
    { name: "Needs", value: needs, percentage: needs },
  ];

  return (
    <PieChart width={400} height={175}>
      <Pie
        data={data}
        cx={200}
        cy={125}
        startAngle={180}
        endAngle={0}
        innerRadius={85}
        outerRadius={100}
        paddingAngle={5}
        dataKey="value"
        cornerRadius={10}
        stroke="none"
      >
        {data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Legend content={<CustomLegend />} />
    </PieChart>
  );
}

const CustomLegend = ({ payload }: LegendProps) => {
  if (!payload) return null;

  return (
    <ul className="flex justify-center gap-4 mt-4">
      {payload.map((entry, index) => {
        const item = entry.payload as unknown as { name: string; percentage: number };

        return (
          <motion.div
            key={`legend-${index}`}
            initial={{ opacity: 0, x: "-25%" }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 100,
              delay: 1,
            }}
          >
            <li className="flex items-center gap-2 text-sm">
              <span
                className="w-4 h-4 rounded-md"
                style={{ backgroundColor: entry.color }}
              />
              <span>
                {item.name} <span className="opacity-50">{item.percentage}%</span>
              </span>
            </li>
          </motion.div>
        );
      })}
    </ul>
  );
};