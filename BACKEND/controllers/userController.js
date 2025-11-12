// --- START OF FILE controllers/userController.js ---

import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

// This controller function will handle changing the password for ANY logged-in user
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // 1. Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Please provide your current and new password." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters long." });
  }

  try {
    // 2. Get user from the 'protect' middleware and retrieve their password
    // We need to find the user again with .select('+password') because it's hidden by default.
    let user = await Admin.findById(req.user.id).select("+password");
    if (!user) {
        user = await Employee.findById(req.user.id).select("+password");
    }

    if (!user) {
        return res.status(401).json({ message: "User not found." });
    }

    // 3. Check if the provided currentPassword is correct
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }

    // 4. If correct, set the new password and save.
    // The password will be automatically hashed by the .pre('save') middleware.
    user.password = newPassword;
    await user.save();

    // 5. Send a success response
    res.status(200).json({ status: "success", message: "Password changed successfully." });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};