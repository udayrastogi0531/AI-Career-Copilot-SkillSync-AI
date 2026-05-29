import { asyncHandler } from "../utils/asyncHandler.js";
import { getDashboardStats } from "../services/dashboardService.js";

export const dashboardStatsController = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats(req.user.id);
  res.json({ success: true, stats });
});
