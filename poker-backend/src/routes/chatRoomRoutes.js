const express = require("express");

const {
  createChatRoom,
  getActiveChatRoomFriends,
  getChatRoomById,
  getChatRooms,
  inviteChatRoomFriends,
  seedDefaultChatRooms,
  sendChatRoomGiftClip,
} = require("../controllers/chatRoomController");
const { optionalUser, protectUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalUser, getChatRooms);
router.post("/", protectUser, createChatRoom);
router.get("/active-friends", protectUser, getActiveChatRoomFriends);
router.post("/dev/seed-defaults", seedDefaultChatRooms);
router.get("/:roomId", optionalUser, getChatRoomById);
router.post("/:roomId/invites", protectUser, inviteChatRoomFriends);
router.post("/:roomId/gift-clips", protectUser, sendChatRoomGiftClip);

module.exports = router;
