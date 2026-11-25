import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "https://oc-03032d383a394b22b7f89260f7135f8d.ecs.us-east-1.on.aws";
//const API_BASE_URL = "http://localhost:8080";
const TARGET_SIZE = 224;

function formatSpeciesName(raw) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word, idx) => (idx === 0 ? word : word.toLowerCase()))
    .join(" ");
}

function cropAndResizeTo224(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const srcWidth = img.naturalWidth;
      const srcHeight = img.naturalHeight;
      const cropSize = Math.min(srcWidth, srcHeight);
      const offsetX = (srcWidth - cropSize) / 2;
      const offsetY = (srcHeight - cropSize) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        offsetX,
        offsetY,
        cropSize,
        cropSize,
        0,
        0,
        TARGET_SIZE,
        TARGET_SIZE
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to process image."));
          }
        },
        "image/jpeg",
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load selected image."));
    };

    img.src = objectUrl;
  });
}

export default function App() {
  const [processedBlob, setProcessedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setResult(null);
    setError(null);

    try {
      const croppedBlob = await cropAndResizeTo224(file);
      setProcessedBlob(croppedBlob);
      setPreviewUrl(URL.createObjectURL(croppedBlob));
    } catch (err) {
      setError(err.message || "Failed to process image.");
    }
  };

  const handleClassify = async () => {
    if (!processedBlob) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", processedBlob, "occlupanid_224.jpg");

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