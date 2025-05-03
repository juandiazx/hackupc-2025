interface ExpenseItemInterface {
  amount: number;
  date: Date;
  category: string;
  description: string;
  wants: boolean;
}

const CategoryImageRoutes: Record<string, string> = {
  Groceries: "/groceries.svg",
  "Dining Out": "/dining-out.svg",
  Shopping: "/shopping.svg",
  Transportation: "/transport.svg",
  Entertainment: "/entertainment.svg",
  Utilities: "/utilities.svg",
  "Personal Care": "/personal-care.svg",
  Health: "/health.svg",
  Travel: "/travel.svg",
  Education: "/education.svg",
};

const ExpenseItem = (props: ExpenseItemInterface) => {
  return (
    <div className="inline-flex justify-between w-full px-8 items-center mx-auto">
      <div className="inline-flex gap-3">
        <img src={CategoryImageRoutes[props.category]} alt={props.category} />

        <div>
          <h3 className="text-base font-semibold">{props.category}</h3>
          <p className="text-sm text-white/60 leading-3">{props.date.toLocaleDateString("en-GB")}</p>
        </div>
      </div>
      <div className="">
        <p className="text-xl font-light tracking-tight inline-flex">{props.amount} €</p>
        <p className={`text-sm font-semibold
          ${props.wants ? "text-[#FF5959]F" : "text-[#5F7CFA]"}`}>
          {props.wants ? "Wants" : "Needs"}
        </p>
      </div>
    </div>
  );
};

export default ExpenseItem;
