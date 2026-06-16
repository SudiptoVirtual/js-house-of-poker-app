const express = require("express");

const {
  createChatRoom,
  createOrGetDirectChatRoom,
  getActiveChatRoomFriends,
  getChatRoomById,
  getChatRooms,
  inviteChatRoomFriends,
  markChatRoomNotificationsRead,
  sendChatRoomGiftClip,
} = require("../controllers/chatRoomController");
const { optionalUser, protectUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalUser, getChatRooms);
router.post("/", protectUser, createChatRoom);
router.post("/direct", protectUser, createOrGetDirectChatRoom);
router.get("/active-friends", protectUser, getActiveChatRoomFriends);
router.get("/:roomId", optionalUser, getChatRoomById);
router.post("/:roomId/invites", protectUser, inviteChatRoomFriends);
router.post("/:roomId/notifications/read", protectUser, markChatRoomNotificationsRead);
router.post("/:roomId/gift-clips", protectUser, sendChatRoomGiftClip);

module.exports = router;
