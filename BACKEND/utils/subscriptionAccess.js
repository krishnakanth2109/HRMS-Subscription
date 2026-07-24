import Admin from "../models/adminModel.js";
import PlanSetting from "../models/planSettingModel.js";
import { getBillableEmployeesCount } from "./billingHelper.js";

const GRACE_PERIOD_DAYS = 7;

export const getGracePeriodEndDate = (planExpiresAt) => {
  if (!planExpiresAt) return null;
  const gracePeriodEndDate = new Date(planExpiresAt);
  gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + GRACE_PERIOD_DAYS);
  return gracePeriodEndDate;
};

export const resolveRootAdmin = async (user) => {
  if (!user) return null;
  if (user.role === "admin" && !user.adminId) return user;
  const rootAdminId = user.adminId || user._id;
  return rootAdminId ? Admin.findById(rootAdminId) : null;
};

export const getExpiredSubscriptionPayload = async (rootAdmin, role = "admin") => {
  if (!rootAdmin) return null;

  let isUnlimitedPlan = false;
  let expiresAt = null;
  let activatedAt = null;
  let planName = "Free";
  let maxUsers = 30;

  if (rootAdmin.planDetails && rootAdmin.planDetails.planName) {
    const details = rootAdmin.planDetails;
    isUnlimitedPlan = details.isUnlimited;
    expiresAt = details.expiresAt;
    activatedAt = details.activatedAt;
    planName = details.planName;
    maxUsers = details.maxUsers;
  } else {
    // Fallback for pre-migration documents
    const planInfo = await PlanSetting.findOne({ planName: rootAdmin.plan });
    isUnlimitedPlan = planInfo && (planInfo.isUnlimited || planInfo.isOwnerPlan);
    expiresAt = rootAdmin.planExpiresAt;
    activatedAt = rootAdmin.planActivatedAt;
    planName = rootAdmin.plan || "Free";
    maxUsers = rootAdmin.userLimit || 30;
  }

  if (isUnlimitedPlan || !expiresAt) return null;

  const now = new Date();
  const expiryDate = new Date(expiresAt);
  const gracePeriodEndDate = getGracePeriodEndDate(expiryDate);

  if (!gracePeriodEndDate || now <= gracePeriodEndDate) return null;

  const expiredDaysAgo = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
  const billableCount = await getBillableEmployeesCount(rootAdmin._id, activatedAt);
  const employeeCount = Math.max(1, billableCount);

  return {
    status: 403,
    body: {
      message: "Your plan has expired and the 7-day grace period has ended. Please pay your bill to restore access.",
      expired: true,
      role,
      adminDetails: {
        name: rootAdmin.name,
        email: rootAdmin.email,
        plan: planName,
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
        expiredDaysAgo,
        employeeCount,
        userLimit: maxUsers,
      },
    },
  };
};

export const blockExpiredSubscription = async (req, res, next) => {
  const rootAdmin = await resolveRootAdmin(req.user);
  const expiredPayload = await getExpiredSubscriptionPayload(rootAdmin, req.user?.role || "admin");
  if (expiredPayload) {
    return res.status(expiredPayload.status).json(expiredPayload.body);
  }
  return next();
};
