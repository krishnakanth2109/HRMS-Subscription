// --- controllers/faceAuthController.js ---

import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import FaceDescriptor from "../models/FaceDescriptor.js";

// Create JWT (same as authController)
const signToken = (id, role, loginMethod = "face") => {
  return jwt.sign({ id, role, loginMethod }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Euclidean distance between two descriptors
const euclideanDistance = (desc1, desc2) => {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
};

// ----------------------------------------------
// REGISTER FACE
// ----------------------------------------------
export const registerFace = async (req, res) => {
  try {
    const { descriptors } = req.body;
    const userId = req.user._id;

    if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
      return res.status(400).json({
        message: "Please provide at least one face descriptor.",
      });
    }

    // Validate each descriptor is a 128-dim array
    for (const desc of descriptors) {
      if (!Array.isArray(desc) || desc.length !== 128) {
        return res.status(400).json({
          message: "Each face descriptor must be a 128-dimensional array.",
        });
      }
    }

    // Determine user type and get user info
    let userType = "Employee";
    let userName = "";
    let userEmail = "";

    const admin = await Admin.findById(userId);
    if (admin) {
      userType = "Admin";
      userName = admin.name;
      userEmail = admin.email;
    } else {
      const employee = await Employee.findById(userId);
      if (employee) {
        userType = "Employee";
        userName = employee.name;
        userEmail = employee.email;
      } else {
        return res.status(404).json({ message: "User not found." });
      }
    }

    // Upsert face descriptor record
    const faceRecord = await FaceDescriptor.findOneAndUpdate(
      { userId, userType },
      {
        userId,
        userType,
        email: userEmail,
        name: userName,
        descriptors,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      status: "success",
      message: "Face registered successfully!",
      data: {
        id: faceRecord._id,
        name: userName,
        descriptorCount: descriptors.length,
      },
    });
  } catch (error) {
    console.error("FACE REGISTER ERROR:", error);
    res.status(500).json({ message: "Failed to register face." });
  }
};

// ----------------------------------------------
// LOGIN WITH FACE
// ----------------------------------------------
export const loginWithFace = async (req, res) => {
  try {
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({
        message: "Please provide a valid 128-dimensional face descriptor.",
      });
    }

    // Get all registered face descriptors
    const allFaces = await FaceDescriptor.find({});

    if (allFaces.length === 0) {
      return res.status(404).json({
        message: "No registered faces found. Please register your face first.",
      });
    }

    // Find the best match
    let bestMatch = null;
    let bestDistance = Infinity;
    const THRESHOLD = 0.42; // Extremely strict distance threshold for 100% accuracy

    for (const faceRecord of allFaces) {
      for (const storedDesc of faceRecord.descriptors) {
        const distance = euclideanDistance(descriptor, storedDesc);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = faceRecord;
        }
      }
    }

    // Check if the best match is below threshold
    if (!bestMatch || bestDistance > THRESHOLD) {
      return res.status(401).json({
        message: "Face not recognized or match not accurate enough. Please try again.",
        distance: bestDistance,
      });
    }

    // Fetch the actual user to generate token
    let user = null;
    let role = null;

    if (bestMatch.userType === "Admin") {
      user = await Admin.findById(bestMatch.userId).select("+role");
      if (user) {
        role = user.role; // "admin" or "manager"
      }
    } else {
      user = await Employee.findById(bestMatch.userId);
      if (user) {
        role = "employee";
      }
    }

    if (!user) {
      return res.status(404).json({
        message: "Matched face but user account no longer exists.",
      });
    }

    // Block deactivated employees
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact support team.",
      });
    }

    // Create token
    const loginMethod = "face";
    const token = signToken(user._id, role, loginMethod);
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      message: `Welcome back, ${bestMatch.name}!`,
      token,
      loginMethod,
      data: {
        ...user.toObject(),
        role,
        loginMethod,
      },
      confidence: Math.round((1 - bestDistance / THRESHOLD) * 100),
    });
  } catch (error) {
    console.error("FACE LOGIN ERROR:", error);
    res.status(500).json({ message: "Face login failed. Please try again." });
  }
};

// ----------------------------------------------
// CHECK IF USER HAS REGISTERED FACE
// ----------------------------------------------
export const checkFaceRegistration = async (req, res) => {
  try {
    const userId = req.user._id;

    const faceRecord = await FaceDescriptor.findOne({ userId });

    return res.status(200).json({
      status: "success",
      registered: !!faceRecord,
      descriptorCount: faceRecord ? faceRecord.descriptors.length : 0,
    });
  } catch (error) {
    console.error("FACE CHECK ERROR:", error);
    res.status(500).json({ message: "Failed to check face registration." });
  }
};

// ----------------------------------------------
// DELETE FACE REGISTRATION
// ----------------------------------------------
export const deleteFaceRegistration = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await FaceDescriptor.findOneAndDelete({ userId });

    if (!result) {
      return res.status(404).json({
        message: "No face registration found.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Face registration deleted successfully.",
    });
  } catch (error) {
    console.error("FACE DELETE ERROR:", error);
    res.status(500).json({ message: "Failed to delete face registration." });
  }
};
