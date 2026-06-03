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

  const planInfo = await PlanSetting.findOne({ planName: rootAdmin.plan });
  const isUnlimitedPlan = planInfo && (planInfo.isUnlimited || planInfo.isOwnerPlan);
  if (isUnlimitedPlan || !rootAdmin.planExpiresAt) return null;

  const now = new Date();
  const expiryDate = new Date(rootAdmin.planExpiresAt);
  const gracePeriodEndDate = getGracePeriodEndDate(expiryDate);

  if (!gracePeriodEndDate || now <= gracePeriodEndDate) return null;

  const expiredDaysAgo = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
  const billableCount = await getBillableEmployeesCount(rootAdmin._id, rootAdmin.planActivatedAt);
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
        plan: rootAdmin.plan,
        planActivatedAt: rootAdmin.planActivatedAt,
        planExpiresAt: rootAdmin.planExpiresAt,
        expiredDaysAgo,
        employeeCount,
        userLimit: rootAdmin.userLimit || 30,
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
