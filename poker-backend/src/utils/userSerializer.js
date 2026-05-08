function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    chips: user.chips,
    walletBalance: user.walletBalance,
    status: user.status,
    isOnline: user.isOnline,
    lastLoginAt: user.lastLoginAt,
    avatar: user.avatar,
    playerStatus: user.playerStatus?.tier || "NO_STATUS",
    statusIcon: user.playerStatus?.iconKey || "badge-no-status",
    referralCode: user.referralCode || null,
    referredByCode: user.referredByCode || null,
    referralStats: {
      invitesSent: user.referralStats?.invitesSent || 0,
      lastInviteSentAt: user.referralStats?.lastInviteSentAt || null,
      lastSuccessfulReferralAt: user.referralStats?.lastSuccessfulReferralAt || null,
      successfulReferrals: user.referralStats?.successfulReferrals || 0,
    },
  };
}

module.exports = {
  serializeUser,
};
