import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExpenseItem from "./ExpenseItem";
import { MonthlyExpensesReport } from "../types/types.ts";

interface ExpensePopUpProps {
  expenses: MonthlyExpensesReport["expenses"];
  togglePopup: () => void;
}

const ExpensesPopUp = ({ expenses, togglePopup }: ExpensePopUpProps) => {
  const [filterPopUp, setFilterPopUp] = useState(false);
  const [filters, setFilters] = useState({ category: "", type: "" });

  const [sortType, setSortType] = useState<
    | "name-asc"
    | "name-desc"
    | "price-asc"
    | "price-desc"
    | "date-asc"
    | "date-desc"
  >("date-desc");

  const toggleFilter = () => setFilterPopUp(!filterPopUp);

  const applyFilters = (items: typeof expenses) => {
    return items.filter((item) => {
      const matchesCategory = filters.category
        ? filters.category.split(",").includes(item.category)
        : true;
      const matchesType = filters.type
        ? filters.type === "wants"
          ? item.want
          : !item.want
        : true;
      return matchesCategory && matchesType;
    });
  };

  const applySort = (items: typeof expenses) => {
    if (!sortType) return items;
    return [...items].sort((a, b) => {
      switch (sortType) {
        case "name-asc":
          return a.description.localeCompare(b.description);
        case "name-desc":
          return b.description.localeCompare(a.description);
        case "price-asc":
          return a.amount - b.amount;
        case "price-desc":
          return b.amount - a.amount;
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        default:
          return a.description.localeCompare(b.description);
      }
    });
  };

  const processedExpenses = applySort(applyFilters(expenses));

  return (
    <>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="h-9/10 w-screen bg-[#001021] absolute z-50 bottom-0 rounded-t-2xl overflow-clip"
      >
        <div className="inline-flex justify-between w-full py-4 px-6">
          <div className="inline-flex gap-4">
            <button
              onClick={toggleFilter}
              className="inline-flex gap-1 items-center"
            >
              <img src="/filter.svg" />
              Filter
            </button>
            <div>
              <button
                onClick={() => {
                  const nextSortType =
                    sortType === "name-asc"
                      ? "name-desc"
                      : sortType === "name-desc"
                      ? "price-asc"
                      : sortType === "price-asc"
                      ? "price-desc"
                      : sortType === "price-desc"
                      ? "date-asc"
                      : sortType === "date-asc"
                      ? "date-desc"
                      : "name-asc";

                  setSortType(nextSortType);
                }}
                className="inline-flex gap-1 items-center"
              >
                <img src="/sort.svg" />
                {sortType === "name-asc" ? (
                  <>
                    Sort: Name <span className="text-gray-400">(A-Z)</span>
                  </>
                ) : sortType === "name-desc" ? (
                  <>
                    Sort: Name <span className="text-gray-400">(Z-A)</span>
                  </>
                ) : sortType === "price-asc" ? (
                  <>
                    Sort: Price{" "}
                    <span className="text-gray-400">(Low-High)</span>
                  </>
                ) : sortType === "price-desc" ? (
                  <>
                    Sort: Price{" "}
                    <span className="text-gray-400">(High-Low)</span>
                  </>
                ) : sortType === "date-asc" ? (
                  <>
                    Sort: Date <span className="text-gray-400">(Old-New)</span>
                  </>
                ) : (
                  <>
                    Sort: Date <span className="text-gray-400">(New-Old)</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <button onClick={togglePopup}>
            <img src="/close.svg" alt="X" />
          </button>
        </div>

        <div className="flex flex-col h-screen overflow-y-scroll">
          <Divider />
          {processedExpenses.map((item, index) => (
            <div key={index}>
              <ExpenseItem
                amount={item.amount}
                date={item.date}
                category={item.category}
                description={item.description}
                wants={item.want}
              />
              <Divider />
            </div>
          ))}
        </div>
        {/* Filter Popup */}
        <AnimatePresence>
          {filterPopUp && (
            <>
              {/* Blurred darkened background */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-radial from-black/80 from-30% to-transparent backdrop-blur-sm z-40"
                onClick={toggleFilter}
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-9/10 fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-[#001021] border border-white/20 rounded-xl p-6 flex flex-col gap-4"
              >
                <div>
                  <p className="text-sm text-white/60 mb-2">Category</p>
                  <div className="grid grid-cols-2 space-x-4 gap-2">
                    {[
                      { name: "Groceries", icon: "/groceries.svg" },
                      { name: "Dining Out", icon: "/dining-out.svg" },
                      { name: "Shopping", icon: "/shopping.svg" },
                      { name: "Transportation", icon: "/transport.svg" },
                      { name: "Entertainment", icon: "/entertainment.svg" },
                      { name: "Utilities", icon: "/utilities.svg" },
                      { name: "Personal Care", icon: "/personal-care.svg" },
                      { name: "Health", icon: "/health.svg" },
                      { name: "Travel", icon: "/travel.svg" },
                      { name: "Education", icon: "/education.svg" },
                    ].map((category) => (
                      <label
                        key={category.name}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          className="accent-white"
                          checked={filters.category
                            .split(",")
                            .includes(category.name)}
                          onChange={() => {
                            const selectedCategories = filters.category
                              ? filters.category.split(",")
                              : [];
                            const updatedCategories =
                              selectedCategories.includes(category.name)
                                ? selectedCategories.filter(
                                    (cat) => cat !== category.name
                                  )
                                : [...selectedCategories, category.name];
                            setFilters((prevFilters) => ({
                              ...prevFilters,
                              category: updatedCategories.join(","),
                            }));
                          }}
                        />
                        <img
                          src={category.icon}
                          alt={category.name}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-white/60 mb-2">Type</p>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="type"
                        className="accent-white rounded-full"
                        checked={filters.type === "wants"}
                        onChange={() =>
                          setFilters({ ...filters, type: "wants" })
                        }
                      />
                      <span className="text-sm">Wants</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="type"
                        className="accent-white rounded-full"
                        checked={filters.type === "needs"}
                        onChange={() =>
                          setFilters({ ...filters, type: "needs" })
                        }
                      />
                      <span className="text-sm">Needs</span>
                    </label>
                  </div>
                </div>
                <div className="inline-flex justify-between">
                  <button
                    onClick={() => setFilters({ category: "", type: "" })}
                    className="border border-red-400 mt-4 px-3 py-1 rounded self-end"
                  >
                    Remove Filters
                  </button>
                  <button
                    onClick={toggleFilter}
                    className="border border-white mt-2 px-3 py-1 rounded self-end"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </>
          )}
          )
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default ExpensesPopUp;

const Divider = () => {
  return <div className="w-8/10 bg-white/70 h-[1px] mx-auto my-3" />;
};
