import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    info: "bg-nero-700",
  };

  return (
    <div className={`${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm`}>
      {message}
    </div>
  );
}
