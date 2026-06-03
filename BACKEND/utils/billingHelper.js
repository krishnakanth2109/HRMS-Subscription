import Employee from "../models/employeeModel.js";
import SupportAdmin from "../models/supportAdminModel.js";

/**
 * Calculates the number of billable seats for an admin's billing cycle.
 * Counts ALL employees (active + inactive) + ALL support admins (active + inactive).
 * Admin/owner is excluded since they are the account holder, not a paid seat.
 *
 * @param {string} adminId
 * @param {Date|string} planActivatedAt  (unused but kept for API compatibility)
 * @returns {Promise<number>}
 */
export const getBillableEmployeesCount = async (adminId, planActivatedAt) => {
  const [employeeCount, supportAdminCount] = await Promise.all([
    Employee.countDocuments({ adminId }),
    SupportAdmin.countDocuments({ adminId }),
  ]);

  return employeeCount + supportAdminCount;
};

