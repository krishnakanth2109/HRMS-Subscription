import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaFingerprint,
  FaShieldAlt,
  FaSpinner,
  FaTrash,
} from "react-icons/fa";
import {
  deleteWebAuthnCredential,
  getWebAuthnCredentials,
  getWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
} from "../api";
import { AuthContext } from "../context/AuthContext";

const FingerprintSetupCard = () => {
  const { user } = useContext(AuthContext);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [fpCredentials, setFpCredentials] = useState([]);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpMessage, setFpMessage] = useState({ type: "", text: "" });
  const fingerprintLabel = useMemo(() => {
    const normalizedRole = String(user?.role || "").toLowerCase();

    if (normalizedRole === "admin") {
      return "Admin Fingerprint";
    }

    if (normalizedRole === "manager") {
      return "Manager Fingerprint";
    }

    return "Employee Fingerprint";
  }, [user?.role]);

  useEffect(() => {
    const initBiometric = async () => {
      try {
        if (
          window.PublicKeyCredential &&
          typeof window.PublicKeyCredential
            .isUserVerifyingPlatformAuthenticatorAvailable === "function"
        ) {
          const available =
            await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricSupported(available);
        }
      } catch {
        setBiometricSupported(false);
      }

      try {
        const res = await getWebAuthnCredentials();
        if (res.success) {
          setFpCredentials(res.credentials || []);
        }
      } catch {
        // Non-critical for initial load.
      }
    };

    initBiometric();
  }, []);

  const refreshCredentials = async () => {
    const res = await getWebAuthnCredentials();
    if (res.success) {
      setFpCredentials(res.credentials || []);
    }
  };

  const handleRegisterFingerprint = async () => {
    if (!biometricSupported) {
      setFpMessage({
        type: "error",
        text: "Fingerprint authentication is not supported on this device.",
      });
      return;
    }

    setFpLoading(true);
    setFpMessage({ type: "", text: "" });

    try {
      const { options } = await getWebAuthnRegistrationOptions();

      // Safely pad base64url strings before atob decoding to prevent invalid length errors
      const safeAtob = (str) => {
        let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) base64 += "=";
        return atob(base64);
      };

      const challengeBuffer = Uint8Array.from(safeAtob(options.challenge), (c) =>
        c.charCodeAt(0)
      );

      const userIdBuffer = Uint8Array.from(safeAtob(options.user.id), (c) =>
        c.charCodeAt(0)
      );

      const excludeCredentials = (options.excludeCredentials || []).map(
        (cred) => ({
          ...cred,
          id: Uint8Array.from(safeAtob(cred.id), (c) => c.charCodeAt(0)),
        })
      );

      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: challengeBuffer,
          user: { ...options.user, id: userIdBuffer },
          excludeCredentials,
        },
      });

      const credentialData = {
        id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
        type: credential.type,
        transports: credential.response.getTransports
          ? credential.response.getTransports()
          : [],
        response: {
          attestationObject: btoa(
            String.fromCharCode(
              ...new Uint8Array(credential.response.attestationObject)
            )
          ),
          clientDataJSON: btoa(
            String.fromCharCode(
              ...new Uint8Array(credential.response.clientDataJSON)
            )
          ),
        },
      };

      const result = await verifyWebAuthnRegistration(
        credentialData,
        options.challenge,
        fingerprintLabel
      );

      if (result.success) {
        setFpMessage({
          type: "success",
          text: "Fingerprint registered successfully.",
        });
        await refreshCredentials();
      } else {
        setFpMessage({
          type: "error",
          text: result.message || "Fingerprint registration failed.",
        });
      }
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setFpMessage({
          type: "error",
          text: "Fingerprint registration was cancelled.",
        });
      } else if (err.name === "InvalidStateError") {
        setFpMessage({
          type: "error",
          text: "This fingerprint is already registered.",
        });
      } else {
        setFpMessage({
          type: "error",
          text:
            err.response?.data?.message || "Fingerprint registration failed.",
        });
      }
    } finally {
      setFpLoading(false);
    }
  };

  const handleDeleteFpCredential = async (credId) => {
    if (!window.confirm("Remove this fingerprint credential?")) {
      return;
    }

    try {
      await deleteWebAuthnCredential(credId);
      setFpCredentials((prev) => prev.filter((cred) => cred._id !== credId));
      setFpMessage({
        type: "success",
        text: "Fingerprint credential removed.",
      });
    } catch {
      setFpMessage({
        type: "error",
        text: "Failed to remove fingerprint credential.",
      });
    }
  };

  return (
    <div className="flex h-full flex-col rounded-[2rem] border border-emerald-100 bg-white p-6 md:p-10 shadow-lg shadow-emerald-100/60">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
          <FaFingerprint className="text-3xl" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-500">
            Fingerprint
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-slate-800">
            Register Fingerprint Login
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            Use your device biometrics to sign in faster with the existing
            fingerprint authentication flow.
          </p>
        </div>
      </div>

      {!biometricSupported ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Fingerprint authentication is not supported on this device.
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <FaShieldAlt className="text-emerald-500" />
                <span className="text-sm font-semibold">Secure Device Login</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Registration stays linked to your authenticated HRMS account.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-slate-700">
                <FaCheckCircle className="text-blue-500" />
                <span className="text-sm font-semibold">Ready for Auto Login</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Once added, you can use the fingerprint option directly on the
                login screen.
              </p>
            </div>
          </div>

          {fpMessage.text && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
                fpMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {fpMessage.type === "success" ? <FaCheckCircle /> : "!"}
              <span>{fpMessage.text}</span>
            </div>
          )}

          {fpCredentials.length > 0 && (
            <div className="mb-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Registered Devices
              </p>
              <div className="space-y-3">
                {fpCredentials.map((cred) => (
                  <div
                    key={cred._id || cred.credentialId}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FaFingerprint className="text-lg text-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {cred.deviceName || "Fingerprint Device"}
                        </p>
                        <p className="text-xs text-slate-400">
                          Registered{" "}
                          {new Date(cred.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFpCredential(cred._id)}
                      className="rounded-xl p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Remove credential"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleRegisterFingerprint}
            disabled={fpLoading}
            id="register-fingerprint-btn"
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fpLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Scanning Fingerprint...
              </>
            ) : (
              <>
                <FaFingerprint className="text-lg" />
                Register Fingerprint
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default FingerprintSetupCard;
