const SocialAccount = require('../models/SocialAccount')
const asyncHandler = require('../utils/asyncHandler')
const ApiResponse = require('../utils/ApiResponse')

const getConnectedAccounts = asyncHandler(async (req, res) => {
  const accounts = await SocialAccount.find({
    userId: req.user._id,
    connected: true,
  })
    .select('platform platformUserId username connected createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const uniqueAccounts = accounts.filter(
    (account, index, list) =>
      list.findIndex(
        (item) =>
          item.platform === account.platform &&
          item.platformUserId === account.platformUserId
      ) === index
  )

  return res.status(200).json(
    ApiResponse(
      200,
      uniqueAccounts,
      'Connected social accounts fetched successfully'
    )
  )
})

module.exports = { getConnectedAccounts }