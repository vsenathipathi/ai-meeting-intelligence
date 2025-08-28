import React, { useState, useEffect } from "react";

function HistoricalData() {
  const [records, setRecords] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5); // adjust rows per page

  // Fetch all records when component loads
  useEffect(() => {
    fetch("http://EC2-publicIP:8000/records") // replace with your backend URL
      .then((res) => res.json())
      .then((data) => setRecords(data))
      .catch((err) => console.error("Failed to fetch records:", err));
  }, []);

  // Pagination logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = records.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(records.length / rowsPerPage);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h2 className="text-xl font-bold mb-4 text-center">Meeting History</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 shadow rounded">
          <thead>
            <tr className="bg-gray-200 text-gray-600 text-left text-sm uppercase font-semibold">
              <th className="py-2 px-4 border-b">ID</th>
              <th className="py-2 px-4 border-b">TiTle</th>
              <th className="py-2 px-4 border-b">Transcript</th>
              <th className="py-2 px-4 border-b">Insights</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="py-2 px-4 border-b">{record.id}</td>
                <td className="py-2 px-4 border-b whitespace-pre-wrap">
                  {record.title}
                </td>
                <td className="py-2 px-4 border-b whitespace-pre-wrap">
                  {record.transcript}
                </td>
                <td className="py-2 px-4 border-b whitespace-pre-wrap">
                  {record.insights}
                </td>
              </tr>
            ))}
            {currentRows.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center py-4 text-gray-500">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <button
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={handlePrev}
          disabled={currentPage === 1}
        >
          Previous
        </button>

        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>

        <button
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={handleNext}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default HistoricalData;
