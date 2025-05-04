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
        <img className="size-10" src={CategoryImageRoutes[props.category]} alt={props.category} />

        <div className="w-fit">
          <h3 className="text-base w-[18ch] font-semibold">{props.description}</h3>
          <p className="text-sm text-white/60 leading-3">{new Date(props.date).toLocaleDateString("en-GB")}</p>
        </div>
      </div>
      <div className="w-fit">
        <p className="text-xl font-light tracking-tight inline-flex text-right w-full">{props.amount} €</p>
        <p className={`text-sm font-semibold text-right
          ${props.wants ? "text-[#FF5959]" : "text-[#5F7CFA]"}`}>
          {props.wants ? "Wants" : "Needs"}
        </p>
      </div>
    </div>
  );
};

export default ExpenseItem;
