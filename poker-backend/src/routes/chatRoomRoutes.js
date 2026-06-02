const express = require("express");

const {
  getChatRoomById,
  getChatRooms,
  seedDefaultChatRooms,
} = require("../controllers/chatRoomController");

const router = express.Router();

router.get("/", getChatRooms);
router.post("/dev/seed-defaults", seedDefaultChatRooms);
router.get("/:roomId", getChatRoomById);

module.exports = router;
