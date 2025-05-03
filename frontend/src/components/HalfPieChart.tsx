import { PieChart, Pie, Cell, Legend, LegendProps } from 'recharts';

type DataItem = {
  name: string;
  value: number;
  percentage: string;
};

const rawData: Omit<DataItem, 'percentage'>[] = [
  { name: 'Wants', value: 60 },
  { name: 'Needs', value: 40 },
];

const total = rawData.reduce((sum, entry) => sum + entry.value, 0);

const data: DataItem[] = rawData.map((entry) => ({
  ...entry,
  percentage: ((entry.value / total) * 100).toFixed(1),
}));

const COLORS = ['#5F7CFA', '#FF5959'];

const CustomLegend = ({ payload }: LegendProps) => {
    if (!payload) return null;
  
    return (
      <ul className="flex justify-center gap-4 mt-4">
        {payload.map((entry, index) => {
          const { name, percentage } = entry.payload as unknown as DataItem;
          return (
            <li key={`item-${index}`} className="flex items-center gap-2 text-sm">
              <span
                className="w-4 h-4 rounded-md"
                style={{ backgroundColor: entry.color }}
              />
              <span>{`${name}: ${percentage}%`}</span>
            </li>
          );
        })}
      </ul>
    );
  };
  

export default function HalfPieChart() {
  return (
    <PieChart width={400} height={200}>
    <Pie
      data={data}
      cx={200}
      cy={150}
      startAngle={180}
      endAngle={0}
      innerRadius={90}
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
