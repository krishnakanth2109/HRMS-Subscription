import React from "react";
import { useNavigate } from "react-router-dom";

const SubsHome = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a, #020617)",
        color: "white",
        minHeight: "100vh",
        fontFamily: "Segoe UI, sans-serif",
      }}
    >
      {/* NAVBAR */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 60px",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: "bold" }}>
          HRMS<span style={{ color: "#38bdf8" }}>Pro</span>
        </div>

        <ul
          style={{
            display: "flex",
            gap: 30,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <li style={{ cursor: "pointer", opacity: 0.85 }}>Features</li>
          <li style={{ cursor: "pointer", opacity: 0.85 }}>Pricing</li>
          <li style={{ cursor: "pointer", opacity: 0.85 }}>Benefits</li>
        </ul>

        <button
          onClick={() => navigate("/login")}
          style={{
            background: "linear-gradient(135deg, #2563eb, #38bdf8)",
            border: "none",
            padding: "10px 20px",
            borderRadius: 20,
            color: "white",
            cursor: "pointer",
          }}
        >
          Get Started
        </button>
      </nav>

      {/* PRICING */}
      <section style={{ textAlign: "center", padding: "60px 40px" }}>
        <h1 style={{ fontSize: 42, marginBottom: 50 }}>
          Simple, Transparent Pricing
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 30,
          }}
        >
          {/* FREE */}
          <PlanCard
            title="Free Trial"
            price="Free"
            features={["Up to 10 employees", "Basic management"]}
            onClick={() => navigate("/login")}
          />

          {/* BASIC */}
          <PlanCard
            title="Basic"
            price="₹15,000"
            features={["Up to 50 employees", "Payroll processing"]}
            border="2px solid #38bdf8"
            onClick={() => navigate("/login")}
          />

          {/* MEDIUM */}
          <PlanCard
            title="Medium"
            price="₹25,000"
            features={["Up to 200 employees", "Advanced analytics"]}
            border="2px solid #a855f7"
            badge="MOST POPULAR"
            onClick={() => navigate("/login")}
          />

          {/* PREMIUM */}
          <PlanCard
            title="Premium"
            price="₹50,000"
            features={["Unlimited employees", "Custom integrations"]}
            onClick={() => navigate("/login")}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          textAlign: "center",
          padding: 20,
          opacity: 0.6,
        }}
      >
        © {new Date().getFullYear()} HRMSPro. All rights reserved.
      </footer>
    </div>
  );
};

/* ---------- PLAN CARD COMPONENT ---------- */
const PlanCard = ({
  title,
  price,
  features,
  onClick,
  border,
  badge,
}) => {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: 20,
        padding: 30,
        position: "relative",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        outline: border,
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: -15,
            right: 20,
            background: "linear-gradient(135deg, #a855f7, #ec4899)",
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 12,
          }}
        >
          {badge}
        </span>
      )}

      <h3>{title}</h3>
      <h2 style={{ fontSize: 32, margin: "15px 0" }}>{price}</h2>

      {features.map((f, i) => (
        <p key={i} style={{ margin: "10px 0", opacity: 0.85 }}>
          ✔ {f}
        </p>
      ))}

      <button
        onClick={onClick}
        style={{
          marginTop: 20,
          padding: 10,
          width: "100%",
          border: "none",
          borderRadius: 15,
          background: "#2563eb",
          color: "white",
          cursor: "pointer",
        }}
      >
        Choose {title}
      </button>
    </div>
  );
};

export default SubsHome;