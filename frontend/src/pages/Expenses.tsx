import { useState } from "react";
import HalfPieChart from "../components/HalfPieChart";
import Menu from "../components/Menu";
import PredictionChart from "../components/PredictionChart";
import ExpensesPopUp from "../components/ExpensesPopUp";
import { AnimatePresence } from "framer-motion";

const Expenses = () => {
  const [expensesPopUp, setExpensesPopUp] = useState(false);

  const togglePopUp = () => {
    setExpensesPopUp(!expensesPopUp);
  };

  return (
    <>
      <h2 className="w-fit">Monthly expenses</h2>
      <div className="w-9/10 bg-container rounded-lg h-fit px-3 pt-3 pb-5 flex flex-col items-center mb-6">
        <div className="inline-flex justify-between h-fit w-full">
          <div className="ml-1">
            <h3>Distribution</h3>
            <p className="text-white/70 light text-sm leading-3">
              From 1 - 4 of May, 2025
            </p>
          </div>
          <button
            onClick={() => togglePopUp()}
            className="border-2 border-primary rounded-lg px-3 text-sm h-fit py-2 hover:bg-white/10"
          >
            All expenses
          </button>
        </div>
        <HalfPieChart></HalfPieChart>
      </div>

      <div className="w-9/10 bg-container rounded-lg h-fit px-3 py-3 flex flex-col items-center mb-6">
        <h3 className="ml-2 w-full mb-6">Expense projection</h3>
        <PredictionChart />
      </div>

      <AnimatePresence>
        {expensesPopUp && <ExpensesPopUp togglePopup={togglePopUp} />}
      </AnimatePresence>

      {!expensesPopUp && <Menu />}
    </>
  );
};

export default Expenses;
