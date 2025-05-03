import { Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Expenses from "./pages/Expenses";
import ChatHistory from "./pages/ChatHistory";
import Menu from "./components/Menu";

function App() {
  const location = useLocation();

  return (
    <div className="w-screen h-screen flex flex-col items-center overflow-y-hidden">
      <Routes location={location} key={location.pathname}>
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/chat-history" element={<ChatHistory />} />
        <Route path="/" element={<Expenses />} />
      </Routes>
    </div>
  );
}

export default App;
