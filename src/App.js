import { useEffect, useState } from "react";
import "./App.css";

//const API_BASE_URL = "https://oc-03032d383a394b22b7f89260f7135f8d.ecs.us-east-1.on.aws";
const API_BASE_URL = "http://localhost:8080";

function formatSpeciesName(raw) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word, idx) => (idx === 0 ? word : word.toLowerCase()))
    .join(" ");
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    e.target.value = "";
  };

  const handleClassify = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || `Server error (${response.status})`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Failed to classify image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>OcclupanID Classifier</h1>
      <p className="subtitle">Take a photo or upload a bread clip against a plain background.</p>

      <div className="button-row">
        <label className="btn secondary">
          Take Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleFileSelected}
          />
        </label>

        <label className="btn secondary">
          Upload Image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleFileSelected}
          />
        </label>
      </div>

      {previewUrl && (
        <div className="preview-card">
          <img
            src={previewUrl}
            alt="Selected occlupanid"
            width={224}
            height={224}
            className="preview-img"
          />
          <button className="btn primary" onClick={handleClassify} disabled={loading}>
            {loading ? "Identifying..." : "Identify Species"}
          </button>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {result && (
        <section className="result-card">
          <div className="top-match">
            <span className="badge">Best Match</span>
            <h2>
              <em>{formatSpeciesName(result.topClass)}</em>
            </h2>
            <p className="confidence">
              {(result.confidence * 100).toFixed(2)}% confidence ({result.inferenceTimeMs} ms)
            </p>
          </div>

          <h3>Top Candidates</h3>
          <ul className="candidate-list">
            {result.topCandidates.map((c) => (
              <li key={c.className}>
                <div className="candidate-header">
                  <span>
                    <em>{formatSpeciesName(c.className)}</em>
                  </span>
                  <span>{(c.probability * 100).toFixed(1)}%</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(2, c.probability * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}