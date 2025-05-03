import { useState } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const Menu = () => {
  const [activeTab, setActiveTab] = useState<string | undefined>("expenses");

  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname.split("/")[1];
    setActiveTab(currentPath || "expenses");
  }, [location]);

  return (
    <motion.div
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      transition={{ type: "spring", delay: 0.5}}
      
      className={`fixed bottom-6 flex justify-between bg-[radial-gradient(circle_at_25%_50%,#007FFF,#02203D_90%)] gap-6 px-6 py-4 rounded-full`}
    >
      <Link
      className={`size-10 rounded-full invert ${
        activeTab === "expenses" ? "" : "opacity-50"
      }`}
      to="/expenses"
      >
      <img className="" src="/expenses.svg" alt="expenses" />
      </Link>
      <Link
      className={`size-10 rounded-full invert ${
        activeTab === "chat-history" ? "" : "opacity-50"
      }`}
      to="/chat-history"
      >
      <img className="" src="/chat-history.svg" alt="chat history" />
      </Link>
    </motion.div>
  );
};
export default Menu;

function gradient(arg0: number, arg1: any, arg2: number, FFF: any, arg4: any, arg5: number, arg6: number) {
  throw new Error("Function not implemented.");
}
