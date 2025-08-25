// client/src/pages/Requests.jsx
// client/src/pages/Requests.jsx
import React, { useState, useEffect } from "react";
import "../styles/Requests.css";
import DashboardLayout from "../layouts/DashboardLayout";
import { API_BASE_URL } from "../api/config";



import { getAuthToken } from "../api/authToken";

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState("");

  // Fetch requests
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/requests`);
      const data = await res.json();
      if (data.success) setRequests(data.data);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    }
  };

  // Add request
  const handleAddRequest = async () => {
    if (!newRequest.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ title: newRequest }),
      });

      const data = await res.json();
      if (data.success) {
        setRequests([data.data, ...requests]);
        setNewRequest("");
      }
    } catch (err) {
      console.error("Failed to add request:", err);
    }
  };

  return (
    <DashboardLayout>
      <div className="requests-page">
        <h2 className="requests-title">Subtitle Requests</h2>

        <div className="requests-input">
          <input
            type="text"
            placeholder="Enter a movie or show name..."
            value={newRequest}
            onChange={(e) => setNewRequest(e.target.value)}
          />
          <button
            onClick={handleAddRequest}
            className="request-btn"
            disabled={!newRequest.trim()}
          >
            Add Request
          </button>
        </div>

        {requests.length === 0 ? (
          <p className="no-requests">
            No requests yet. Add your first request!
          </p>
        ) : (
          <ul className="requests-list">
            {requests.map((req) => (
              <li
                key={req._id}
                className={`request-item ${req.status.toLowerCase()}`}
              >
                <span>{req.title}</span>
                <span className={`status ${req.status.toLowerCase()}`}>
                  {req.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Requests;
