import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './contexts/GameContext';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Quests from './pages/Quests';
import Pomodoro from './pages/Pomodoro';
import Journal from './pages/Journal';
import Achievements from './pages/Achievements';
import Summary from './pages/Summary';
import Inventory from './pages/Inventory';

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="quests" element={<Quests />} />
            <Route path="pomodoro" element={<Pomodoro />} />
            <Route path="journal" element={<Journal />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="summary" element={<Summary />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}
