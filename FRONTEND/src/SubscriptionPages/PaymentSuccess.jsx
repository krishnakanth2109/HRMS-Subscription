// src/pages/PaymentSuccess.jsx
import { useSearchParams, useNavigate } from "react-router-dom";

const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = params.get("session_id");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-green-600">
        Payment Successful 🎉
      </h1>

      <p className="mt-2 text-gray-600">
        Your admin account has been created successfully.
      </p>

      {sessionId && (
        <p className="mt-2 text-xs text-gray-400">
          Session ID: {sessionId}
        </p>
      )}

      <button
        onClick={() => navigate("/login")}
        className="mt-6 bg-purple-600 text-white px-6 py-3 rounded-xl"
      >
        Go to Login
      </button>
    </div>
  );
};

export default PaymentSuccess;