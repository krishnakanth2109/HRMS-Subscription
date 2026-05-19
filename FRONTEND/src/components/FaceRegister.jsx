// --- components/FaceRegister.jsx ---
// Face Registration Component with Guided Instructions + Liveness Detection

import { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCamera,
  FaTimes,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaRedo,
  FaTrash,
  FaArrowLeft,
  FaArrowRight,
  FaArrowUp,
  FaArrowDown,
  FaEye,
} from "react-icons/fa";
import { HiOutlineFaceSmile } from "react-icons/hi2";
import { registerFaceApi, checkFaceStatusApi, deleteFaceApi } from "../api";

const FACE_LOCK_HOLD_MS = 1200;

const getCameraErrorMessage = (error) => {
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "No camera was found. Connect or enable a webcam, then try again.";
  }
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "Camera access was blocked. Please allow camera permission in the browser.";
  }
  if (error?.name === "NotReadableError") {
    return "Your camera is already in use by another app. Close it and try again.";
  }
  return "Unable to start the camera. Please check your camera settings.";
};

const requestCameraStream = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera is not supported in this browser.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });
  } catch (error) {
    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
      throw error;
    }

    return navigator.mediaDevices.getUserMedia({ video: true });
  }
};

// ========== EYE ASPECT RATIO (For Blink Detection) ==========
const getEAR = (eye) => {
  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  const v1 = dist(eye[1], eye[5]);
  const v2 = dist(eye[2], eye[4]);
  const h = dist(eye[0], eye[3]);
  if (h === 0) return 0;
  return (v1 + v2) / (2.0 * h);
};

const getBlinkRatio = (landmarks) => {
  const p = landmarks.positions;
  const leftEye = [p[36], p[37], p[38], p[39], p[40], p[41]];
  const rightEye = [p[42], p[43], p[44], p[45], p[46], p[47]];
  return (getEAR(leftEye) + getEAR(rightEye)) / 2.0;
};

// ========== HEAD STRAIGHTNESS ==========
const getHeadYaw = (landmarks) => {
  const p = landmarks.positions;
  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  const nose = p[30];
  const leftEdge = p[1];
  const rightEdge = p[15];
  const leftDist = dist(nose, leftEdge);
  const rightDist = dist(nose, rightEdge);
  if (rightDist === 0) return 1.0;
  return leftDist / rightDist;
};

// ========== BRIGHTNESS CHECK ==========
const checkBrightness = (videoEl) => {
  const canvas = document.createElement("canvas");
  canvas.width = 50; 
  canvas.height = 50;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, 50, 50);
  const data = ctx.getImageData(0, 0, 50, 50).data;
  let colorSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    colorSum += Math.floor((data[i] + data[i+1] + data[i+2]) / 3);
  }
  return Math.floor(colorSum / (50 * 50));
};

// Step-by-step guided instructions for each capture
const CAPTURE_STEPS = [
  {
    instruction: "Look straight at the camera",
    description: "Keep your face centered and look directly at the camera",
    icon: "straight",
    emoji: "😐",
  },
  {
    instruction: "Slowly turn your head LEFT",
    description: "Turn your head slightly to the left, keep eyes on camera",
    icon: "left",
    emoji: "👈",
  },
  {
    instruction: "Slowly turn your head RIGHT",
    description: "Turn your head slightly to the right, keep eyes on camera",
    icon: "right",
    emoji: "👉",
  },
  {
    instruction: "Tilt your head slightly UP",
    description: "Raise your chin slightly while looking at the camera",
    icon: "up",
    emoji: "👆",
  },
  {
    instruction: "Tilt your head slightly DOWN",
    description: "Lower your chin slightly while looking at the camera",
    icon: "down",
    emoji: "👇",
  },
];

const DirectionIcon = ({ direction, className = "" }) => {
  const iconClass = `text-2xl ${className}`;
  switch (direction) {
    case "left":
      return <FaArrowLeft className={iconClass} />;
    case "right":
      return <FaArrowRight className={iconClass} />;
    case "up":
      return <FaArrowUp className={iconClass} />;
    case "down":
      return <FaArrowDown className={iconClass} />;
    case "straight":
      return <HiOutlineFaceSmile className={`text-3xl ${className}`} />;
    default:
      return null;
  }
};

const FaceRegister = ({ onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const countdownRef = useRef(null);
  const livenessIntervalRef = useRef(null);

  // Liveness tracking refs
  const verificationStartTimeRef = useRef(null);
  const isDetectingRef = useRef(false);
  const faceLockStartTimeRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState("loading"); // loading, ready, liveness, capturing, countdown, success, error, registered
  const [statusMessage, setStatusMessage] = useState("Loading face recognition models...");
  const [capturedDescriptors, setCapturedDescriptors] = useState([]);
  const [captureCount, setCaptureCount] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [lockProgressState, setLockProgressState] = useState(0);

  const REQUIRED_CAPTURES = CAPTURE_STEPS.length;

  // Get current step info
  const currentStep = CAPTURE_STEPS[captureCount] || CAPTURE_STEPS[0];

  // Check existing registration & load models
  useEffect(() => {
    const init = async () => {
      try {
        // Check if face is already registered
        const statusRes = await checkFaceStatusApi();
        if (statusRes?.registered) {
          setIsRegistered(true);
          setStatus("registered");
          setStatusMessage(
            `Face already registered (${statusRes.descriptorCount} samples).`
          );
        }

        // Load models
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);

        if (!statusRes?.registered) {
          setStatus("ready");
          setStatusMessage("Models loaded! Click 'Start Capture' to begin face registration.");
        }
      } catch (error) {
        console.error("Init error:", error);
        setStatus("error");
        setStatusMessage("Failed to initialize. Please try again.");
      }
    };

    init();

    return () => {
      stopCamera();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (livenessIntervalRef.current) clearInterval(livenessIntervalRef.current);
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          if (!livenessVerified) {
            setStatus("liveness");
            setStatusMessage("👱 Please keep your head straight to begin...");
            startLivenessCheck();
          } else {
            setStatus("capturing");
            setStatusMessage(currentStep.instruction);
          }
        };
      }
    } catch (error) {
      console.error("Camera error:", error);
      setStatus("error");
      setStatusMessage(getCameraErrorMessage(error));
    }
  };

  const stopCamera = () => {
    isDetectingRef.current = false;
    if (livenessIntervalRef.current) {
      clearTimeout(livenessIntervalRef.current);
      livenessIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // ========== LIVENESS CHECK (2-BLINK SENSOR) ==========
  const startLivenessCheck = () => {
    // Reset liveness state
    verificationStartTimeRef.current = null;
    isDetectingRef.current = true;
    faceLockStartTimeRef.current = null;
    setLockProgressState(0);

    let faceFoundCount = 0;

    const detectLoop = async () => {
      if (!isDetectingRef.current) return;
      if (!videoRef.current || videoRef.current.readyState < 2) {
        livenessIntervalRef.current = setTimeout(detectLoop, 50);
        return;
      }

      try {
        const brightness = checkBrightness(videoRef.current);
        if (brightness < 30) {
            if (canvasRef.current) {
               const ctx = canvasRef.current.getContext("2d");
               ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            setStatusMessage("⚠️ Room is too dark. Please turn on a light.");
            livenessIntervalRef.current = setTimeout(detectLoop, 500); 
            return;
        }

        const detection = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks();

        if (canvasRef.current && videoRef.current) {
          const displaySize = {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight,
          };
          faceapi.matchDimensions(canvasRef.current, displaySize);
          const ctx = canvasRef.current.getContext("2d");
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

          if (detection) {
            if (!verificationStartTimeRef.current) {
              verificationStartTimeRef.current = Date.now();
            }

            // Soft reset instead of hard-failing real users during registration.
            if (Date.now() - verificationStartTimeRef.current > 15000) {
              verificationStartTimeRef.current = Date.now();
              faceLockStartTimeRef.current = null;
              setLockProgressState(0);
              setStatusMessage("⏳ Hold still and keep your face centered to verify.");
            }

            faceFoundCount++;
            const resized = faceapi.resizeResults(detection, displaySize);
            const { x, y, width, height } = resized.detection.box;

            // ===== ANTI-SPOOFING: CENTER CONSTRAINT =====
            // Prevent attackers from sliding a flat photo left/right to fake 3D perspective warp.
            // The face MUST remain strictly in the center of the camera while turning the head.
            const boxCenterX = x + width / 2;
            const frameCenterX = displaySize.width / 2;
            const allowedDeviation = displaySize.width * 0.15; // 15% allowed deviation

            if (Math.abs(boxCenterX - frameCenterX) > allowedDeviation) {
              faceLockStartTimeRef.current = null;
              setLockProgressState(0);
              setStatusMessage("🎯 Please move your face to the exact center.");

              ctx.strokeStyle = "#ef4444";
              ctx.lineWidth = 4;
              ctx.strokeRect(x, y, width, height);

              // Re-queue immediately skipping liveness checks
              if (isDetectingRef.current) {
                livenessIntervalRef.current = setTimeout(detectLoop, 0);
              }
              return;
            }

            // Draw face box
            ctx.strokeStyle = "#8b5cf6";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(x, y, width, height);

            if (faceFoundCount >= 2) {
              const yawRatio = getHeadYaw(resized.landmarks);

              if (yawRatio < 0.75 || yawRatio > 1.25) {
                faceLockStartTimeRef.current = null;
                setLockProgressState(0);
                setStatusMessage("👱 Please face straight forward to verify.");
              } else {
                if (!faceLockStartTimeRef.current) {
                  faceLockStartTimeRef.current = Date.now();
                }

                const holdElapsed = Date.now() - faceLockStartTimeRef.current;
                const holdProgress = Math.min(
                  100,
                  Math.round((holdElapsed / FACE_LOCK_HOLD_MS) * 100)
                );
                setLockProgressState(holdProgress);

                if (holdElapsed >= FACE_LOCK_HOLD_MS) {
                  isDetectingRef.current = false;
                  setLivenessVerified(true);
                  setStatus("capturing");
                  setStatusMessage("✅ Liveness verified! Now follow the instructions below.");

                  // Clear canvas
                  if (canvasRef.current) {
                    const ctx2 = canvasRef.current.getContext("2d");
                    ctx2.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  }
                  setTimeout(() => {
                    setStatusMessage(CAPTURE_STEPS[0].instruction);
                  }, 1500);
                  return; // Stop liveness loop
                } else {
                  setStatusMessage("✅ Face detected. Hold still for quick verification...");
                }
              }
            }
          } else {
            faceFoundCount = 0;
            faceLockStartTimeRef.current = null;
            setLockProgressState(0);
          }
        }
      } catch (err) {
        console.error("Liveness check error:", err);
      }

      if (isDetectingRef.current) {
        livenessIntervalRef.current = setTimeout(detectLoop, 0);
      }
    };

    detectLoop();
  };

  const startCountdownCapture = useCallback(() => {
    setStepCompleted(false);
    setCountdown(3);
    setStatus("countdown");

    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        captureFace();
      }
    }, 1000);
  }, [captureCount, capturedDescriptors]);

  const captureFace = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;

    try {
      setStatus("capturing");
      setStatusMessage("Detecting face...");

      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatusMessage("⚠ No face detected! Make sure your face is visible and try again.");
        return;
      }

      // Draw detection on canvas
      if (canvasRef.current) {
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        const resized = faceapi.resizeResults(detection, displaySize);
        const { x, y, width, height } = resized.detection.box;

        // Green success box
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);

        // Flash effect
        ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
        ctx.fillRect(x, y, width, height);

        // Checkmark
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 24px Arial";
        ctx.fillText("✓", x + width - 30, y + 28);
      }

      // Flash animation
      setCaptureFlash(true);
      setTimeout(() => setCaptureFlash(false), 300);

      const descriptor = Array.from(detection.descriptor);
      const newDescriptors = [...capturedDescriptors, descriptor];
      setCapturedDescriptors(newDescriptors);

      const newCount = captureCount + 1;
      setCaptureCount(newCount);
      setStepCompleted(true);

      if (newCount >= REQUIRED_CAPTURES) {
        setStatusMessage("✅ All captures done! Saving your face data...");
        await saveFaceData(newDescriptors);
      } else {
        // Show success briefly then show next instruction
        setStatusMessage(`✅ Step ${newCount} complete!`);
        setTimeout(() => {
          setStepCompleted(false);
          const nextStep = CAPTURE_STEPS[newCount];
          setStatusMessage(nextStep.instruction);
        }, 1500);
      }
    } catch (error) {
      console.error("Capture error:", error);
      setStatusMessage("Capture failed. Please try again.");
    }
  };

  const saveFaceData = async (descriptors) => {
    setSaving(true);
    try {
      const res = await registerFaceApi(descriptors);
      if (res?.status === "success") {
        setStatus("success");
        setStatusMessage("🎉 Face registered successfully! You can now use face login.");
        setIsRegistered(true);
        stopCamera();
      } else {
        throw new Error(res?.message || "Registration failed");
      }
    } catch (error) {
      console.error("Save error:", error);
      setStatus("error");
      setStatusMessage(
        error.response?.data?.message || "Failed to save face data. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSaving(true);
      await deleteFaceApi();
      setIsRegistered(false);
      setCapturedDescriptors([]);
      setCaptureCount(0);
      setStatus("ready");
      setStatusMessage("Face registration removed. You can register again.");
    } catch (error) {
      console.error("Delete error:", error);
      setStatusMessage("Failed to remove face registration.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (livenessIntervalRef.current) clearInterval(livenessIntervalRef.current);
    setCapturedDescriptors([]);
    setCaptureCount(0);
    setCountdown(0);
    setStepCompleted(false);
    setLivenessVerified(false);

    // Reset refs
    verificationStartTimeRef.current = null;
    faceLockStartTimeRef.current = null;
    setLockProgressState(0);

    setStatus("ready");
    setStatusMessage("Reset. Click 'Start Capture' to begin again.");
    stopCamera();
  };

  const handleClose = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    stopCamera();
    onClose();
  };

  const progress = (captureCount / REQUIRED_CAPTURES) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-lg mx-4 bg-gradient-to-br from-[#1a1640] via-[#2d2568] to-[#1e1a4a] rounded-3xl shadow-2xl border border-purple-500/30 overflow-hidden"
        >
          {/* Glow effects */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-6 py-4 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <FaCamera className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Register Face</h3>
                <p className="text-purple-300/70 text-xs">Train face recognition for login</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            >
              <FaTimes />
            </button>
          </div>

          {/* Camera View */}
          <div className="relative px-6 py-5">
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/40 border border-purple-500/20">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ transform: "scaleX(-1)" }}
              />

              {/* Capture flash effect */}
              <AnimatePresence>
                {captureFlash && (
                  <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-white/40 z-10"
                  />
                )}
              </AnimatePresence>
              {/* Liveness instruction overlay */}
              {status === "liveness" && cameraActive && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="bg-purple-600/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-purple-400/30 flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >
                      <FaEye className="text-white text-lg" />
                    </motion.div>
                    <span className="text-white text-sm font-bold">Face Lock Verification</span>
                  </motion.div>
                </div>
              )}

              {/* Direction arrow overlays on the video (only after liveness verified) */}
              {(status === "liveness" || status === "capturing" || status === "countdown") && cameraActive && livenessVerified && !stepCompleted && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Direction indicator */}
                  {currentStep.icon === "left" && (
                    <motion.div
                      className="absolute left-4 top-1/2 -translate-y-1/2"
                      animate={{ x: [0, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <div className="bg-purple-600/80 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-purple-400/30">
                        <FaArrowLeft className="text-white text-2xl" />
                      </div>
                    </motion.div>
                  )}
                  {currentStep.icon === "right" && (
                    <motion.div
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      animate={{ x: [0, 10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <div className="bg-purple-600/80 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-purple-400/30">
                        <FaArrowRight className="text-white text-2xl" />
                      </div>
                    </motion.div>
                  )}
                  {currentStep.icon === "up" && (
                    <motion.div
                      className="absolute top-4 left-1/2 -translate-x-1/2"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <div className="bg-purple-600/80 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-purple-400/30">
                        <FaArrowUp className="text-white text-2xl" />
                      </div>
                    </motion.div>
                  )}
                  {currentStep.icon === "down" && (
                    <motion.div
                      className="absolute bottom-4 left-1/2 -translate-x-1/2"
                      animate={{ y: [0, 10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <div className="bg-purple-600/80 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-purple-400/30">
                        <FaArrowDown className="text-white text-2xl" />
                      </div>
                    </motion.div>
                  )}
                  {currentStep.icon === "straight" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        className="w-44 h-56 rounded-[50%] border-2 border-dashed border-purple-400/50"
                        animate={{ scale: [1, 1.03, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Countdown overlay */}
              {status === "countdown" && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-7xl font-black text-white drop-shadow-2xl"
                  >
                    {countdown}
                  </motion.div>
                </div>
              )}

              {/* Guide overlay when not capturing */}
              {!cameraActive && status !== "success" && status !== "registered" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-purple-300">
                    <FaCamera className="text-4xl mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Camera is off</p>
                  </div>
                </div>
              )}

              {/* Success overlay */}
              {(status === "success" || status === "registered") && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <FaCheckCircle className="text-green-400 text-5xl mx-auto mb-3" />
                    <p className="text-green-300 font-bold text-lg">
                      {status === "registered" ? "Face Registered" : "Registration Complete!"}
                    </p>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Liveness progress indicator */}
            {status === "liveness" && cameraActive && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-300 text-xs font-medium flex items-center gap-1.5">
                    <FaEye className="text-lg" /> Face Lock
                  </span>
                  <span className="text-purple-300 text-xs font-bold">
                    {lockProgressState}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-purple-900/50">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-green-400"
                    animate={{ width: `${lockProgressState}%` }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                </div>
                <p className="text-purple-300/50 text-xs text-center mt-2">
                  Keep your face straight and centered for instant verification.
                </p>
              </div>
            )}

            {/* Step instruction card */}
            {(status === "capturing" || status === "countdown") && cameraActive && (
              <motion.div
                key={captureCount}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-4 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-400/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-4">
                  {/* Step icon */}
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-400/20 flex items-center justify-center">
                    {stepCompleted ? (
                      <FaCheckCircle className="text-green-400 text-2xl" />
                    ) : (
                      <DirectionIcon direction={currentStep.icon} className="text-purple-300" />
                    )}
                  </div>
                  {/* Step text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
                        STEP {captureCount + 1} OF {REQUIRED_CAPTURES}
                      </span>
                    </div>
                    <p className="text-white font-bold text-sm">
                      {stepCompleted ? "✅ Captured!" : currentStep.instruction}
                    </p>
                    <p className="text-purple-300/60 text-xs mt-0.5">
                      {stepCompleted
                        ? "Preparing next step..."
                        : currentStep.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step progress dots */}
            {(status === "capturing" || status === "countdown") && cameraActive && (
              <div className="mt-3 flex items-center justify-center gap-2">
                {CAPTURE_STEPS.map((step, idx) => (
                  <motion.div
                    key={idx}
                    className={`h-2.5 rounded-full transition-all duration-300 ${idx < captureCount
                      ? "w-8 bg-green-500"
                      : idx === captureCount
                        ? "w-8 bg-purple-500"
                        : "w-2.5 bg-purple-800"
                      }`}
                    animate={
                      idx === captureCount
                        ? { scale: [1, 1.2, 1] }
                        : {}
                    }
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                ))}
              </div>
            )}

            {/* Status message (shown when NOT in step mode) */}
            {status !== "capturing" && status !== "countdown" && (
              <motion.div
                key={statusMessage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${status === "error"
                  ? "bg-red-500/10 border border-red-500/30 text-red-300"
                  : status === "success" || status === "registered"
                    ? "bg-green-500/10 border border-green-500/30 text-green-300"
                    : "bg-purple-500/10 border border-purple-500/30 text-purple-300"
                  }`}
              >
                {status === "error" ? (
                  <FaExclamationTriangle className="flex-shrink-0" />
                ) : status === "success" || status === "registered" ? (
                  <FaCheckCircle className="flex-shrink-0" />
                ) : saving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <FaSpinner className="flex-shrink-0" />
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-2 w-2 rounded-full bg-purple-400 flex-shrink-0"
                  />
                )}
                <span>{statusMessage}</span>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3">
              {status === "ready" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={startCamera}
                  disabled={!modelsLoaded}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
                >
                  {modelsLoaded ? "Start Capture" : "Loading Models..."}
                </motion.button>
              )}

              {(status === "capturing" || status === "countdown") && cameraActive && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={startCountdownCapture}
                    disabled={saving || status === "countdown" || stepCompleted}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FaCamera />
                    {status === "countdown"
                      ? `Capturing in ${countdown}...`
                      : stepCompleted
                        ? "✅ Captured!"
                        : `Capture (${captureCount + 1}/${REQUIRED_CAPTURES})`}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleReset}
                    className="px-4 py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all flex items-center gap-2"
                  >
                    <FaRedo />
                  </motion.button>
                </>
              )}

              {status === "registered" && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setIsRegistered(false);
                      setCapturedDescriptors([]);
                      setCaptureCount(0);
                      setStepCompleted(false);
                      setStatus("ready");
                      setStatusMessage("Ready to re-register. Click 'Start Capture'.");
                    }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all"
                  >
                    Re-Register Face
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-4 py-3 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all flex items-center gap-2 border border-red-500/30"
                  >
                    <FaTrash />
                    Remove
                  </motion.button>
                </>
              )}

              {status === "error" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold hover:from-purple-500 hover:to-indigo-500 transition-all"
                >
                  Try Again
                </motion.button>
              )}

              {status === "success" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-bold hover:from-green-500 hover:to-emerald-500 transition-all"
                >
                  Done
                </motion.button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5">
            <p className="text-purple-300/50 text-xs text-center">
              Follow the on-screen instructions for each step. Good lighting ensures best accuracy.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FaceRegister;
