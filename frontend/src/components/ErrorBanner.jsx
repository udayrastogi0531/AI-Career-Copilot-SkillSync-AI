import { useEffect, useRef } from "react";
import { toast } from "sonner";

const ErrorBanner = ({ message }) => {
  const lastMessageRef = useRef("");

  useEffect(() => {
    if (!message || lastMessageRef.current === message) {
      return;
    }

    lastMessageRef.current = message;
    toast.error(message);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="fade-in-up rounded-xl border border-ember/50 bg-ember/10 p-3 text-sm text-rose-200">
      {message}
    </div>
  );
};

export default ErrorBanner;
