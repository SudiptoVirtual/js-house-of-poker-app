const Transaction = require("../models/Transaction");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const getTransactions = async (req, res) => {
  try {
    const {
      type = "",
      status = "",
      userId = "",
      fromDate = "",
      toDate = "",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Transaction.countDocuments(filter);

    const transactions = await Transaction.find(filter)
      .populate("userId", "name email")
      .populate("createdByAdminId", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      message: "Transactions fetched successfully",
      page: pageNumber,
      limit: limitNumber,
      total,
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

const getWithdrawals = async (req, res) => {
  try {
    const {
      status = "",
      userId = "",
      fromDate = "",
      toDate = "",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (userId) filter.userId = userId;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const total = await WithdrawalRequest.countDocuments(filter);

    const withdrawals = await WithdrawalRequest.find(filter)
      .populate("userId", "name email walletBalance chips status")
      .populate("approvedByAdminId", "name email")
      .populate("rejectedByAdminId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      message: "Withdrawals fetched successfully",
      page: pageNumber,
      limit: limitNumber,
      total,
      withdrawals,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching withdrawals",
      error: error.message,
    });
  }
};

const approveWithdrawal = async (req, res) => {
  try {
    const { adminNote = "" } = req.body;

    const withdrawal = await WithdrawalRequest.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal request not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Only pending withdrawals can be approved",
      });
    }

    const user = await User.findById(withdrawal.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found for this withdrawal",
      });
    }

    if (user.walletBalance < withdrawal.amount) {
      return res.status(400).json({
        message: "User wallet balance is insufficient for this withdrawal",
      });
    }

    user.walletBalance -= withdrawal.amount;
    await user.save();

    withdrawal.status = "approved";
    withdrawal.adminNote = adminNote;
    withdrawal.approvedByAdminId = req.admin._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    const transaction = await Transaction.create({
      userId: withdrawal.userId,
      type: "withdrawal",
      amount: withdrawal.amount,
      status: "approved",
      provider: withdrawal.provider,
      referenceId: withdrawal.referenceId || "",
      note: adminNote || "Withdrawal approved by admin",
      createdByAdminId: req.admin._id,
      meta: {
        withdrawalRequestId: withdrawal._id.toString(),
      },
    });

    await AuditLog.create({
      adminId: req.admin._id,
      action: "WITHDRAWAL_APPROVED",
      targetType: "WithdrawalRequest",
      targetId: withdrawal._id.toString(),
      meta: {
        userId: withdrawal.userId.toString(),
        amount: withdrawal.amount,
        transactionId: transaction._id.toString(),
      },
    });

    return res.status(200).json({
      message: "Withdrawal approved successfully",
      withdrawal,
      transaction,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error approving withdrawal",
      error: error.message,
    });
  }
};

const rejectWithdrawal = async (req, res) => {
  try {
    const { reason } = req.body;

    const withdrawal = await WithdrawalRequest.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal request not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Only pending withdrawals can be rejected",
      });
    }

    withdrawal.status = "rejected";
    withdrawal.rejectionReason = reason;
    withdrawal.rejectedByAdminId = req.admin._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    const transaction = await Transaction.create({
      userId: withdrawal.userId,
      type: "withdrawal",
      amount: withdrawal.amount,
      status: "rejected",
      provider: withdrawal.provider,
      referenceId: withdrawal.referenceId || "",
      note: reason,
      createdByAdminId: req.admin._id,
      meta: {
        withdrawalRequestId: withdrawal._id.toString(),
      },
    });

    await AuditLog.create({
      adminId: req.admin._id,
      action: "WITHDRAWAL_REJECTED",
      targetType: "WithdrawalRequest",
      targetId: withdrawal._id.toString(),
      meta: {
        userId: withdrawal.userId.toString(),
        amount: withdrawal.amount,
        transactionId: transaction._id.toString(),
        reason,
      },
    });

    return res.status(200).json({
      message: "Withdrawal rejected successfully",
      withdrawal,
      transaction,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error rejecting withdrawal",
      error: error.message,
    });
  }
};

module.exports = {
  getTransactions,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};