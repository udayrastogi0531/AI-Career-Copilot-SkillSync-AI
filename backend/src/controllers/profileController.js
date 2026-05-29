import { asyncHandler } from "../utils/asyncHandler.js";
import { getProfile, updateProfile } from "../services/profileService.js";

export const getProfileController = asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user.id);
  res.json({ success: true, profile });
});

export const updateProfileController = asyncHandler(async (req, res) => {
  const profile = await updateProfile(req.user.id, req.body || {});
  res.json({ success: true, profile });
});
