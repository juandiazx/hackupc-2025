import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Legend, LegendProps } from "recharts";

type DataItem = {
  name: string;
  value: number;
  percentage: string;
};

const rawData: Omit<DataItem, "percentage">[] = [
  { name: "Wants", value: 60 },
  { name: "Needs", value: 40 },
];

const total = rawData.reduce((sum, entry) => sum + entry.value, 0);

const data: DataItem[] = rawData.map((entry) => ({
  ...entry,
  percentage: ((entry.value / total) * 100).toFixed(),
}));

const COLORS = ["#5F7CFA", "#FF5959"];

const CustomLegend = ({ payload }: LegendProps) => {
  if (!payload) return null;

  return (
    <ul className="flex justify-center gap-4 mt-4">
      {payload.map((entry, index) => {
        const { name, percentage } = entry.payload as unknown as DataItem;
        return (
          <motion.div initial={{ opacity: "0%", x: "-25%" }} animate={{ opacity: "100%", x: 0 }}
          transition={{type: "spring", damping: 25, stiffness: 100, delay: 1}}>
            <li
              key={`item-${index}`}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="w-4 h-4 rounded-md"
                style={{ backgroundColor: entry.color }}
              />
              <span>
                {name} <span className="opacity-50">{percentage}%</span>
              </span>
            </li>
          </motion.div>
        );
      })}
    </ul>
  );
};

export default function HalfPieChart() {
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
