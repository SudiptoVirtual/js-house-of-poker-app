const express = require("express");
const mongoose = require("mongoose");

const { protectUser } = require("../middleware/auth");
const Notification = require("../models/Notification");

const router = express.Router();

const MAX_LIMIT = 50;

function serialize(notification) {
  return typeof notification?.toClient === "function" ? notification.toClient() : notification;
}

function parsePagination(query = {}) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), MAX_LIMIT);
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
}

router.use(protectUser);

router.get("/", async (req, res, next) => {
  try {
    const { limit, page, skip } = parsePagination(req.query);
    const userId = req.user._id;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ userId, readAt: null }),
      Notification.countDocuments({ userId }),
    ]);

    res.json({
      notifications: notifications.map(serialize),
      page,
      limit,
      total,
      hasMore: skip + notifications.length < total,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, readAt: null });
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", async (req, res, next) => {
  try {
    const readAt = new Date();
    const result = await Notification.updateMany(
      { userId: req.user._id, readAt: null },
      { $set: { readAt } }
    );

    res.json({
      modifiedCount: result.modifiedCount || 0,
      readAt,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:notificationId/read", async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const readAt = new Date();
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user._id },
      { $set: { readAt } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const unreadCount = await Notification.countDocuments({ userId: req.user._id, readAt: null });
    res.json({ notification: serialize(notification), readAt, unreadCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
