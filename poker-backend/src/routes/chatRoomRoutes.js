const express = require("express");

const {
  createChatRoom,
  getActiveChatRoomFriends,
  getChatRoomById,
  getChatRooms,
  inviteChatRoomFriends,
  seedDefaultChatRooms,
} = require("../controllers/chatRoomController");
const { optionalUser, protectUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalUser, getChatRooms);
router.post("/", protectUser, createChatRoom);
router.get("/active-friends", protectUser, getActiveChatRoomFriends);
router.post("/dev/seed-defaults", seedDefaultChatRooms);
router.get("/:roomId", optionalUser, getChatRoomById);
router.post("/:roomId/invites", protectUser, inviteChatRoomFriends);

module.exports = router;
