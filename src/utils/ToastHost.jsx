import { useState } from "react";
import Toast from "./Toast";

let pushToast;

export function toast(message, type = "info") {
  pushToast?.({ message, type });
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  pushToast = (toast) => {
    const id = Date.now();
    setToasts((t) => [...t, { ...toast, id }]);
  };

  const remove = (id) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          {...t}
          onClose={() => remove(t.id)}
        />
      ))}
    </div>
  );
}
