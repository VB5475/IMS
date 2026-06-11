import React from "react";
import { Loader as LucideLoader } from "lucide-react";
import "./loader.css";

export default function Loader({ text = "Loading..." }) {
  return (
    <div className="loader-wrap">
      <LucideLoader size={20} className="loader-spin" />
      {text && <span className="loader-text">{text}</span>}
    </div>
  );
}
