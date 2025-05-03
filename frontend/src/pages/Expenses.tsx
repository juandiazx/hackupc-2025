import HalfPieChart from "../components/HalfPieChart";

const Expenses = () => {
  return (
    <>
      <h2 className="w-fit">Monthly expenses</h2>
      <div className="w-9/10 bg-black rounded-lg h-fit px-3 py-3 flex flex-col items-center mb-6">
        <div className="inline-flex justify-between h-fit w-full">
          <div className="ml-1">
            <h3>Distribution</h3>
            <p className="text-white/70 light text-sm">
              From 1 - 4 of May, 2025
            </p>
          </div>
          <button className="border-2 border-primary rounded-lg px-3 text-sm h-fit py-2 ">
            All transactions
          </button>
        </div>
        <HalfPieChart></HalfPieChart>
      </div>

      <div className="w-9/10 bg-black rounded-lg h-fit px-3 py-3 flex flex-col items-center mb-6">
        <h3 className="ml-2 w-full">Forecast</h3>
        
      </div>
    </>
  );
};

export default Expenses;
