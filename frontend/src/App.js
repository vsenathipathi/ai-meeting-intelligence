import './App.css';
import Home from './Home';
import HistoricalData from './HistoricalData';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
  const handleLogout = () => {
    // Add your logout logic here (clear tokens, redirect, etc.)
    alert("You have been logged out!");
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Browser tab title */}
        <head>
          <title>Meeting Transcription App</title>
        </head>

        {/* Header title */}
        <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
          <h1 className="text-2xl font-bold text-center flex-1">
            Meeting Intelligence App
          </h1>
          <nav className="space-x-2 flex items-center">
            <Link
              to="/"
              className="px-3 py-1 rounded bg-white text-blue-600 hover:bg-gray-200"
            >
              Home
            </Link>
            <Link
              to="/HistoricalData"
              className="px-3 py-1 rounded bg-white text-blue-600 hover:bg-gray-200"
            >
              HistoricalData
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-white text-blue-600 hover:bg-gray-200"
            >
              Logout
            </button>
          </nav>
        </header>

        {/* Main content */}
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/HistoricalData" element={<HistoricalData />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

