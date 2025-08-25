// client/src/pages/Upload.jsx
// client/src/pages/Upload.jsx
// client/src/pages/Upload.jsx
// client/src/pages/Upload.jsx
// client/src/pages/Upload.jsx
// client/src/pages/Upload.jsx
import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/Upload.css";
import DashboardLayout from "../layouts/DashboardLayout";

import { fetchRecentUploads, uploadSubtitle } from "../api/uploadAPI";

const Upload = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recentUploads, setRecentUploads] = useState([]);
  const dropRef = useRef(null);

  const allowedTypes = [".srt", ".vtt", ".sub"];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  /* ------------------------- Fetch Recent Uploads ------------------------ */
  useEffect(() => {
    loadRecentUploads();
  }, []);

  const loadRecentUploads = async () => {
    const uploads = await fetchRecentUploads();
    setRecentUploads(uploads);
  };

  /* --------------------------- File Validation --------------------------- */
  const handleFileValidation = (selectedFile) => {
    const fileExtension = selectedFile.name
      .toLowerCase()
      .substring(selectedFile.name.lastIndexOf("."));

    if (!allowedTypes.includes(fileExtension)) {
      setError("Only .srt, .vtt, or .sub files are allowed.");
      setFile(null);
      return false;
    }

    if (selectedFile.size > maxFileSize) {
      setError("File size must be under 5MB.");
      setFile(null);
      return false;
    }

    setFile(selectedFile);
    setError("");
    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) handleFileValidation(selectedFile);
  };

  /* ---------------------- Drag & Drop Handlers ---------------------- */
  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current.classList.add("drag-over");
  };

  const handleDragLeave = () => {
    dropRef.current.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropRef.current.classList.remove("drag-over");
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileValidation(droppedFile);
  };

  const formatFileSize = (size) =>
    size > 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;

  /* ---------------------------- Upload Logic ---------------------------- */
  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a valid subtitle file before uploading.");
      return;
    }

    setProgress(0);
    setUploading(true);

    try {
      await uploadSubtitle(file, (percent) => setProgress(percent));
      toast.success(`File "${file.name}" uploaded successfully!`);
      setFile(null);
      setProgress(100);
      loadRecentUploads();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="upload-page">
        <h2 className="upload-title">Upload Subtitles</h2>

        {/* Dropzone */}
        <div
          className="upload-dropzone"
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p>Drag & Drop your subtitle file here</p>
          <span>or</span>
          <input
            type="file"
            accept=".srt,.vtt,.sub"
            onChange={handleFileChange}
            className="upload-input"
          />
        </div>

        {/* Error / File Info */}
        {error && <p className="upload-error">{error}</p>}
        {file && (
          <p className="file-info">
            Selected: {file.name} ({formatFileSize(file.size)})
          </p>
        )}

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Upload Button */}
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? <span className="spinner"></span> : "Upload"}
        </button>

        {/* Recent Uploads */}
        {recentUploads.length > 0 && (
          <div className="recent-uploads">
            <h3>Recent Uploads</h3>
            <ul>
              {recentUploads.map((upload, index) => (
                <li key={index} className="upload-item">
                  <span className="upload-name">{upload.originalName}</span>
                  <span className="upload-size">
                    {formatFileSize(upload.size)}
                  </span>
                  <span className="upload-status success">✔</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Upload;
