import { Link } from "react-router-dom";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="center-page">
      <h1>Lost in the void</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link to="/" className="btn primary">Back to Explore</Link>
    </div>
  );
}
