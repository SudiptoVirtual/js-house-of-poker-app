const express = require("express");

const {
  acceptFriend,
  declineFriend,
  getFriendList,
  getFriendStatus,
  requestFriend,
} = require("../controllers/friendController");
const { protectUser } = require("../middleware/auth");

const router = express.Router();

router.post("/request", protectUser, requestFriend);
router.post("/accept", protectUser, acceptFriend);
router.post("/decline", protectUser, declineFriend);
router.get("/status/:userId", protectUser, getFriendStatus);
router.get("/list", protectUser, getFriendList);

module.exports = router;
