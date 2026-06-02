const express = require("express");

const {
  deleteMessage,
  getFlaggedMessages,
  getRoomById,
  getRoomTableLaunches,
  getRooms,
  moderateMessage,
  updateRoomVisibility,
} = require("../controllers/adminChatRoomController");
const { protectAdmin } = require("../middleware/adminAuth");

const router = express.Router();

router.use(protectAdmin);

router.get("/", getRooms);
router.get("/flagged-messages", getFlaggedMessages);
router.patch("/messages/:messageId/moderation", moderateMessage);
router.delete("/messages/:messageId", deleteMessage);
router.get("/:roomId", getRoomById);
router.get("/:roomId/table-launches", getRoomTableLaunches);
router.patch("/:roomId/visibility", updateRoomVisibility);

module.exports = router;
