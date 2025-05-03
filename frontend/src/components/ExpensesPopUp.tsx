import { motion } from "framer-motion";
import ExpenseItem from "./ExpenseItem";

interface ExpensePopUpProps {
  togglePopup: () => void;
}

const ExpensesPopUp = ({ togglePopup }: ExpensePopUpProps) => {
  return (
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="h-9/10 w-screen bg-[#001021] absolute bottom-0 rounded-t-2xl"
      >
        <div className="inline-flex justify-between w-full py-4 px-6">
          <div className="inline-flex gap-4">
            <button className="inline-flex gap-1 items-center">
              <img src="/filter.svg" />
              Filter
            </button>
            <button className="inline-flex gap-1 items-center">
              <img src="/sort.svg" />
              Order
            </button>
          </div>
          <button onClick={togglePopup}>
            <img src="/close.svg" alt="X" />
          </button>
        </div>

        <div className="flex flex-col">
          <Divider />
          {/* {expenses.map((item) => (
          <>
          <ExpenseItem
          amount={item.amount}
              date={item.date}
              category={item.category}
              description={item.description}
              wants={item.wants}
              />
              <Divider />
              </>
              ))} */}
          <ExpenseItem
            amount={200}
            date={new Date()}
            category={"Groceries"}
            description="Pepinos gordos"
            wants={false}
          />
        </div>
      </motion.div>
  );
};

export default ExpensesPopUp;

const Divider = () => {
  return <div className="w-8/10 bg-white/70 h-[1px] mx-auto my-3" />;
};
