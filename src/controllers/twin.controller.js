const twinService = require('../services/twin.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');

const getProfile = catchAsync(async (req, res) => {
  const profile = await twinService.getTwinProfile(req.user.id);
  success(res, profile);
});

const getDashboard = catchAsync(async (req, res) => {
  const [profile, dataSources, conversations] = await Promise.all([
    twinService.getTwinProfile(req.user.id),
    twinService.getDataSourcesSummary(req.user.id),
    twinService.getConversationStats(req.user.id),
  ]);

  success(res, {
    profile,
    dataSources,
    conversations,
  });
});

module.exports = {
  getProfile,
  getDashboard,
};

