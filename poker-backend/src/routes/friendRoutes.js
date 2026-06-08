const express = require("express");

const {
  acceptFriend,
  declineFriend,
  getFriendList,
  getFriendStatus,
  requestFriend,
  searchPlayers,
} = require("../controllers/friendController");
const { protectUser } = require("../middleware/auth");

const router = express.Router();

router.post("/request", protectUser, requestFriend);
router.post("/accept", protectUser, acceptFriend);
router.post("/decline", protectUser, declineFriend);
router.get("/search", protectUser, searchPlayers);
router.get("/status/:userId", protectUser, getFriendStatus);
router.get("/", protectUser, getFriendList);
router.get("/list", protectUser, getFriendList);

module.exports = router;
