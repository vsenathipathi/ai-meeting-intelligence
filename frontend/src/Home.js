import React, { useState, useEffect } from "react";

function Home() {
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false); // spinner state
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResponse(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://EC2-publicIP:8000/upload", {
        method: "POST",
        body: formData,
      });

      // parse json (backend returns structured json)
      const data = await res.json();

      if (!res.ok) {
        // HTTP-level error
        const msg = data.detail || data.message || "Upload failed";
        setError(msg);
      } else {
        // backend returns success flag in updated main.py
        if (data.success === false) {
          setError(data.message || "Processing failed");
        } else {
          setResponse(data);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };


  const [records, setRecords] = useState([]); // list of meetings from sqlite
  const [selectedMeeting, setSelectedMeeting] = useState(""); // meeting id
  const [question, setQuestion] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);

  useEffect(() => {
    // Load meeting titles for the select dropdown
    const loadRecords = async () => {
      try {
        const res = await fetch("http://EC2-publicIP:8000/records");
        const data = await res.json();
        const list = Array.isArray(data)
          ? data.map((r) => ({ id: r.id, title: r.title }))
          : [];
        setRecords(list);
      } catch (err) {
        console.error("Failed to load records:", err);
      }
    };

    loadRecords();
  }, []);

  const handleQuery = async () => {
    if (!selectedMeeting || !question.trim()) return;
    setQueryLoading(true);
    setQueryResult(null);
    setQueryError(null);

    try {
      const res = await fetch("http://EC2-publicIP:8000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_id: parseInt(selectedMeeting), question }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        setQueryError(data.error || data.detail || "Query failed");
      } else {
  
        setQueryResult(data);
      }
    } catch (err) {
      console.error("Query error:", err);
      setQueryError("Query failed: " + (err.message || err));
    } finally {
      setQueryLoading(false);
    }
  };


  return (
    <div className="p-4 max-w-xl mx-auto bg-white rounded-lg shadow space-y-6">
      {/* ---------------- Upload box---------------- */}
      <div className="p-4 bg-white">
        <h2 className="text-lg font-semibold mb-2">Upload Meeting Recording</h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose an audio/video file to generate transcript and insights.
        </p>

        <input
          type="file"
          accept="audio/*,video/*"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setResponse(null);
            setError(null);
          }}
          className="mb-2 block w-full border p-2 rounded"
        />

        {file && (
          <div className="text-sm text-gray-700 mb-2">
            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        )}

        <button
          onClick={handleUpload}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          disabled={loading || !file}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

        {/* Spinner */}
        {loading && (
          <div className="flex justify-center items-center mt-4">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mt-4 p-3 border border-red-300 rounded bg-red-50 text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Upload Response Summary */}
        {response && !loading && (
          <div className="mt-4 p-4 border rounded bg-gray-50">
            <h2 className="font-bold mb-2">Upload Summary</h2>

            <div className="text-sm mb-1">
              <strong>Transcript:</strong>{" "}
              {response.transcript_success ? (
                <span className="text-green-700">Success</span>
              ) : (
                <span className="text-red-700">Failed</span>
              )}
            </div>

            <div className="text-sm mb-1">
              <strong>SQLite DB Write:</strong>{" "}
              {response.db_success ? (
                <span className="text-green-700">Success</span>
              ) : (
                <span className="text-red-700">Failed</span>
              )}
            </div>

            <div className="text-sm mb-1">
              <strong>Chroma Embeddings:</strong>{" "}
              {response.chroma_success ? (
                <span className="text-green-700">Success</span>
              ) : (
                <span className="text-red-700">Failed</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Insights  - */}
      <div className="p-4 bg-white border rounded">
        <h2 className="text-lg font-semibold mb-2">Insights / Query</h2>
        <p className="text-sm text-gray-600 mb-3">
          Select a meeting and ask a question. The system will search the meeting’s
          chunks in ChromaDB and return insights (via Ollama).
        </p>

        <label className="text-sm block mb-2">Select meeting</label>
        <select
          value={selectedMeeting}
          onChange={(e) => setSelectedMeeting(e.target.value)}
          className="mb-3 block w-full border p-2 rounded"
        >
          <option value="">-- Select Meeting --</option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>

        <label className="text-sm block mb-2">Your question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="mb-3 block w-full border p-2 rounded"
          placeholder="e.g. What action items were assigned?"
        />

        <div className="flex gap-2">
          <button
            onClick={handleQuery}
            disabled={queryLoading || !selectedMeeting || !question.trim()}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {queryLoading ? "Querying..." : "Get Insights"}
          </button>

          <button
            onClick={() => {
              setQuestion("");
              setQueryResult(null);
              setQueryError(null);
            }}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            Clear
          </button>
        </div>

        {/* Query error */}
        {queryError && (
          <div className="mt-3 p-3 border border-red-300 rounded bg-red-50 text-red-700">
            {queryError}
          </div>
        )}

        {/* Query results (separate box) */}
        {queryResult && (
          <div className="mt-4 p-3 border rounded bg-gray-50">
            <h3 className="font-bold mb-2">Insights</h3>

            {/* Ollama answer */}
            {queryResult.answer && (
              <div className="mb-3">
                <h4 className="font-semibold">Answer</h4>
                <p className="whitespace-pre-wrap">{queryResult.answer}</p>
              </div>
            )}

            {/* Matched chunks */}
            {queryResult.matches && queryResult.matches.documents && (
              <div>
                <h4 className="font-semibold mb-2">Matched Context</h4>
                {Array.isArray(queryResult.matches.documents[0]) &&
                  queryResult.matches.documents[0].map((doc, i) => (
                    <div key={i} className="mb-2 p-2 bg-white border rounded">
                      <p className="text-sm text-gray-800">{doc}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {JSON.stringify(queryResult.matches.metadatas[0][i])}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;

