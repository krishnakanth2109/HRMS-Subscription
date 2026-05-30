import Employee from "../models/employeeModel.js";

/**
 * Calculates the number of billable employees for an admin's billing cycle.
 * Billed if:
 * 1. Currently Active (isActive === true or status === "Active")
 * 2. Inactive, but were active for MORE than 15 days of the current billing cycle.
 * 
 * @param {string} adminId 
 * @param {Date|string} planActivatedAt 
 * @returns {Promise<number>}
 */
export const getBillableEmployeesCount = async (adminId, planActivatedAt) => {
  const employees = await Employee.find({ adminId });
  
  let billableCount = 0;
  const cycleStart = planActivatedAt ? new Date(planActivatedAt) : new Date();
  const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;

  for (const emp of employees) {
    if (emp.isActive || emp.status === "Active") {
      billableCount++;
    } else {
      // Inactive employee: check if deactivated in the middle of current billing cycle after 15 days
      const deactDate = emp.deactivationDate ? new Date(emp.deactivationDate) : new Date(emp.updatedAt);
      
      if (!isNaN(deactDate.getTime()) && deactDate >= cycleStart) {
        const activeDurationInMs = deactDate.getTime() - cycleStart.getTime();
        if (activeDurationInMs > fifteenDaysInMs) {
          billableCount++;
        }
      }
    }
  }

  return billableCount;
};
