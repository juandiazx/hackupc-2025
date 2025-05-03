import { Routes, Route, useLocation } from "react-router-dom";
import "./App.css";
import Expenses from "./pages/Expenses";
import ChatHistory from "./pages/ChatHistory";

function App() {
  const location = useLocation();

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Expenses />} />
        <Route path="/chat-history" element={<ChatHistory />} />
      </Routes>
    </div>
  );
}

export default App;
