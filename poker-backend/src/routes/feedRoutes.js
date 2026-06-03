const express = require("express");

const {
  addComment,
  createPost,
  createReaction,
  createShare,
  createTableInvite,
  deletePost,
  getDiscoveryPayload,
  getPost,
  listComments,
  listPosts,
  purchasePromotion,
  removeSupport,
  sendGiftClip,
  setSupport,
  updatePost,
} = require("../controllers/feedController");
const { optionalUser, protectUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", optionalUser, listPosts);
router.post("/", protectUser, createPost);
router.get("/discovery", optionalUser, getDiscoveryPayload);
router.get("/:postId", optionalUser, getPost);
router.patch("/:postId", protectUser, updatePost);
router.delete("/:postId", protectUser, deletePost);

router.get("/:postId/comments", optionalUser, listComments);
router.post("/:postId/comments", protectUser, addComment);

router.post("/:postId/support", protectUser, setSupport);
router.delete("/:postId/support", protectUser, removeSupport);
router.post("/:postId/reactions", protectUser, createReaction);
router.delete("/:postId/reactions/support", protectUser, removeSupport);

router.post("/:postId/shares", protectUser, createShare);
router.post("/:postId/gift-clips", protectUser, sendGiftClip);
router.post("/:postId/promotions", protectUser, purchasePromotion);
router.post("/:postId/table-invites", protectUser, createTableInvite);

module.exports = router;
