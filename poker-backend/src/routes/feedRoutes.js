const express = require("express");

const {
  addComment,
  completePromotion,
  createPost,
  createReaction,
  createShare,
  createTableInvite,
  deleteComment,
  deletePost,
  getDiscoveryPayload,
  getPost,
  resolveAuthorProfile,
  resolveChatRoomContext,
  resolveFriendAction,
  resolveTableContext,
  listComments,
  listPosts,
  listReactionSummaries,
  promotionPaymentWebhook,
  purchasePromotion,
  removeSupport,
  sendGiftClip,
  setSupport,
  updateComment,
  updatePost,
} = require("../controllers/feedController");
const { optionalUser, protectUser } = require("../middleware/auth");
const { verifyPromotionWebhookPayload } = require("../services/feedPromotionService");

const router = express.Router();

function verifyPromotionWebhook(req, res, next) {
  try {
    req.verifiedPromotionWebhookPayload = verifyPromotionWebhookPayload({
      body: req.body,
      rawBody: req.rawBody,
      signature: req.headers["stripe-signature"],
    });
    next();
  } catch (error) {
    res.status(error.statusCode || 400).json({
      code: error.code || "STRIPE_WEBHOOK_VERIFICATION_FAILED",
      message: error.message || "Unable to verify promotion payment webhook.",
    });
  }
}

router.get("/", optionalUser, listPosts);
router.post("/promotions/webhook", verifyPromotionWebhook, promotionPaymentWebhook);
router.post("/promotions/:promotionId/complete", protectUser, completePromotion);
router.post("/", protectUser, createPost);
router.get("/discovery", optionalUser, getDiscoveryPayload);
router.get("/:postId", optionalUser, getPost);
router.get("/:postId/author-profile", optionalUser, resolveAuthorProfile);
router.get("/:postId/friend-action", optionalUser, resolveFriendAction);
router.get("/:postId/chat-room", optionalUser, resolveChatRoomContext);
router.get("/:postId/table", optionalUser, resolveTableContext);
router.patch("/:postId", protectUser, updatePost);
router.delete("/:postId", protectUser, deletePost);

router.get("/:postId/comments", optionalUser, listComments);
router.post("/:postId/comments", protectUser, addComment);
router.patch("/:postId/comments/:commentId", protectUser, updateComment);
router.delete("/:postId/comments/:commentId", protectUser, deleteComment);

router.post("/:postId/support", protectUser, setSupport);
router.delete("/:postId/support", protectUser, removeSupport);
router.get("/:postId/reactions", optionalUser, listReactionSummaries);
router.post("/:postId/reactions", protectUser, createReaction);
router.delete("/:postId/reactions/support", protectUser, removeSupport);

router.post("/:postId/shares", protectUser, createShare);
router.post("/:postId/gift-clips", protectUser, sendGiftClip);
router.post("/:postId/promotions", protectUser, purchasePromotion);
router.post("/:postId/promotions/checkout", protectUser, purchasePromotion);
router.post("/:postId/table-invites", protectUser, createTableInvite);

module.exports = router;
