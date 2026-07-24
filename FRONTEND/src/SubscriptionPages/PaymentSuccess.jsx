// src/pages/PaymentSuccess.jsx
import { useSearchParams, useNavigate } from "react-router-dom";

const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // Razorpay passes payment_id; legacy Stripe used session_id
  const paymentId = params.get("payment_id") || params.get("session_id");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg px-10 py-12 flex flex-col items-center max-w-md w-full">
        {/* Checkmark icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-gray-800 mb-2">Payment Successful 🎉</h1>

        <p className="text-gray-500 text-sm text-center mb-4">
          Your admin account has been activated. You can now log in and start using the
          HRMS platform.
        </p>

        {paymentId && (
          <p className="text-xs text-gray-400 bg-gray-100 rounded-lg px-3 py-2 mb-6 font-mono break-all text-center">
            Payment ID: {paymentId}
          </p>
        )}

        <button
          onClick={() => navigate("/login")}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-blue-700 hover:to-cyan-600 transition-all shadow-md shadow-blue-500/30"
        >
          Go to Login →
        </button>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Didn't receive access? Contact{" "}
          <a href="mailto:support@vwsync.com" className="text-blue-500 underline">
            support@vwsync.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccess;
