const mongoose = require("mongoose");
const Stripe = require("stripe");

const FeedPost = require("../models/FeedPost");
const FeedPromotion = require("../models/FeedPromotion");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { getFeedRealtimeService } = require("./feedRealtimeService");
const {
  createFeedPromotionNotification,
  emitFeedNotificationRecords,
} = require("./feedNotificationService");

const DEFAULT_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 90;
const TARGETING_KEYS = ["audience", "gameTypes", "locations", "tableCodes"];
const STRIPE_WEBHOOK_SECRET_ENV_KEYS = [
  "FEED_PROMOTION_STRIPE_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET",
];

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function buildConfigError(message, code = "FEED_PROMOTION_CONFIG_ERROR") {
  const error = new Error(message);
  error.statusCode = 500;
  error.code = code;
  return error;
}

function readRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  return value || null;
}

function getStripeWebhookSecret() {
  for (const key of STRIPE_WEBHOOK_SECRET_ENV_KEYS) {
    const value = readRequiredEnv(key);
    if (value) {
      return value;
    }
  }

  return null;
}

function validateFeedPromotionProductionConfig() {
  if (!isProductionEnvironment()) {
    return;
  }

  const missing = [];
  const provider = String(readRequiredEnv("FEED_PROMOTION_PAYMENT_PROVIDER") || "").toLowerCase();

  if (provider !== "stripe") {
    missing.push("FEED_PROMOTION_PAYMENT_PROVIDER=stripe");
  }

  for (const key of [
    "STRIPE_SECRET_KEY",
    "FEED_PROMOTION_SUCCESS_URL",
    "FEED_PROMOTION_CANCEL_URL",
  ]) {
    if (!readRequiredEnv(key)) {
      missing.push(key);
    }
  }

  if (!getStripeWebhookSecret()) {
    missing.push("FEED_PROMOTION_STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET");
  }

  if (missing.length > 0) {
    throw buildConfigError(
      `Production feed promotions require explicit Stripe configuration: ${missing.join(", ")}.`,
    );
  }
}

function normalizeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDurationDays(value) {
  return Math.min(MAX_DURATION_DAYS, Math.max(1, normalizeInteger(value, DEFAULT_DURATION_DAYS)));
}

function normalizeAmount(value) {
  const amount = normalizeInteger(value, NaN);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeStringList(value, maxItems = 25) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeTargeting(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const targeting = {
    audience: normalizeStringList(value.audience),
    gameTypes: normalizeStringList(value.gameTypes),
    locations: normalizeStringList(value.locations),
    metadata: {},
    tableCodes: normalizeStringList(value.tableCodes).map((code) => code.toUpperCase()),
  };

  if (value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)) {
    for (const [key, raw] of Object.entries(value.metadata).slice(0, 25)) {
      const normalizedKey = String(key || "").trim().slice(0, 80);
      if (!normalizedKey) continue;

      if (["string", "number", "boolean"].includes(typeof raw) || raw == null) {
        targeting.metadata[normalizedKey] = raw;
      }
    }
  }

  for (const key of TARGETING_KEYS) {
    if (targeting[key].length === 0) {
      delete targeting[key];
    }
  }

  if (Object.keys(targeting.metadata).length === 0) {
    delete targeting.metadata;
  }

  return targeting;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getProvider(inputProvider) {
  const configuredProvider = String(process.env.FEED_PROMOTION_PAYMENT_PROVIDER || "").trim().toLowerCase();
  const requestedProvider = String(inputProvider || configuredProvider || "mock").trim().toLowerCase();

  if (isProductionEnvironment()) {
    validateFeedPromotionProductionConfig();
    if (inputProvider && requestedProvider !== "stripe") {
      throw buildConfigError(
        "Production feed promotions only support FEED_PROMOTION_PAYMENT_PROVIDER=stripe.",
        "FEED_PROMOTION_PROVIDER_NOT_ALLOWED",
      );
    }
    return "stripe";
  }

  return requestedProvider === "stripe" ? "stripe" : requestedProvider === "manual" ? "manual" : "mock";
}

function getStripeClient() {
  const secretKey = readRequiredEnv("STRIPE_SECRET_KEY");
  if (!secretKey) {
    if (isProductionEnvironment()) {
      throw buildConfigError("STRIPE_SECRET_KEY is required for production feed promotion checkout.");
    }
    return null;
  }

  return new Stripe(secretKey);
}

function getStripeCheckoutUrls() {
  const successUrl =
    readRequiredEnv("FEED_PROMOTION_SUCCESS_URL") ||
    (!isProductionEnvironment() ? readRequiredEnv("STRIPE_SUCCESS_URL") : null);
  const cancelUrl =
    readRequiredEnv("FEED_PROMOTION_CANCEL_URL") ||
    (!isProductionEnvironment() ? readRequiredEnv("STRIPE_CANCEL_URL") : null);

  if (!successUrl || !cancelUrl) {
    if (isProductionEnvironment()) {
      throw buildConfigError(
        "FEED_PROMOTION_SUCCESS_URL and FEED_PROMOTION_CANCEL_URL are required for production feed promotion checkout.",
      );
    }

    return {
      cancelUrl: cancelUrl || "https://example.com/feed/promotion/cancel",
      successUrl: successUrl || "https://example.com/feed/promotion/success",
    };
  }

  return { cancelUrl, successUrl };
}

async function createStripeCheckoutSession({ amount, durationDays, post, promotion }) {
  const stripe = getStripeClient();
  if (!stripe) {
    return null;
  }

  const { cancelUrl, successUrl } = getStripeCheckoutUrls();

  return stripe.checkout.sessions.create({
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency: process.env.FEED_PROMOTION_CURRENCY || "usd",
          product_data: {
            description: `Sponsored visibility for ${durationDays} day(s).`,
            name: `Feed promotion for post ${post._id}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      feedPromotionId: String(promotion._id),
      postId: String(post._id),
    },
    mode: "payment",
    success_url: successUrl,
  });
}

async function findVisiblePost(postId, currentUserId, session = null) {
  const query = {
    _id: postId,
    "moderation.status": { $ne: "blocked" },
    status: "published",
  };

  if (currentUserId) {
    query.$or = [{ visibility: "public" }, { authorUserId: currentUserId }];
  } else {
    query.visibility = "public";
  }

  return FeedPost.findOne(query).session(session);
}

async function hydrateCurrentUserReaction(post, currentUserId) {
  if (!post || !currentUserId || typeof post.toClient !== "function") {
    return post;
  }

  return post;
}

function serializePost(post, currentUserId) {
  return post.toClient({ currentUserId });
}

async function createPromotionCheckout({ input = {}, postId, user }) {
  const amount = normalizeAmount(input.amount || input.budgetClips);
  if (!amount) {
    const error = new Error("Promotion amount is required.");
    error.statusCode = 400;
    error.code = "PROMOTION_AMOUNT_REQUIRED";
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(String(postId || ""))) {
    const error = new Error("Invalid post id.");
    error.statusCode = 400;
    error.code = "INVALID_POST_ID";
    throw error;
  }

  const post = await findVisiblePost(postId, user._id);
  if (!post) {
    const error = new Error("Feed post not found.");
    error.statusCode = 404;
    error.code = "POST_NOT_FOUND";
    throw error;
  }

  const durationDays = normalizeDurationDays(input.durationDays || input.duration || input.days);
  const now = new Date();
  const startsAt = input.startsAt ? new Date(input.startsAt) : now;
  const normalizedStartsAt = Number.isNaN(startsAt.getTime()) ? now : startsAt;
  const inputEndsAt = input.endsAt ? new Date(input.endsAt) : null;
  const endsAt = inputEndsAt && !Number.isNaN(inputEndsAt.getTime()) ? inputEndsAt : addDays(normalizedStartsAt, durationDays);
  const paymentProvider = getProvider(input.paymentProvider || input.provider);
  const targeting = normalizeTargeting(input.targeting || input.targetingMetadata);
  const shouldActivateImmediately = paymentProvider !== "stripe" || input.markPaid === true;
  const paymentStatus = shouldActivateImmediately ? "paid" : "pending";
  const state = shouldActivateImmediately ? "active" : "pending";
  const paymentReference = String(input.paymentReference || input.referenceId || "").trim();

  const promotion = await FeedPromotion.create({
    amount,
    budgetClips: amount,
    creatorUserId: post.authorUserId,
    durationDays,
    endsAt,
    paymentProvider,
    paymentReference,
    paymentStatus,
    postId: post._id,
    sponsorUserId: user._id,
    startsAt: normalizedStartsAt,
    state,
    targeting,
  });

  const transaction = await Transaction.create({
    amount,
    feedPromotionId: promotion._id,
    meta: {
      creatorUserId: String(post.authorUserId),
      durationDays,
      endsAt: endsAt.toISOString(),
      postId: String(post._id),
      startsAt: normalizedStartsAt.toISOString(),
      targeting,
    },
    note: `Feed promotion sponsorship for post ${post._id}`,
    provider: paymentProvider,
    referenceId: paymentReference || String(promotion._id),
    status: shouldActivateImmediately ? "success" : "pending",
    type: "feed_promotion",
    userId: user._id,
  });

  promotion.transactionId = transaction._id;
  if (!promotion.paymentReference) {
    promotion.paymentReference = String(transaction._id);
  }

  if (paymentProvider === "stripe" && !shouldActivateImmediately) {
    const checkoutSession = await createStripeCheckoutSession({ amount, durationDays, post, promotion });
    if (checkoutSession) {
      promotion.checkoutUrl = checkoutSession.url || "";
      promotion.paymentReference = checkoutSession.id;
      transaction.referenceId = checkoutSession.id;
      transaction.meta = { ...transaction.meta, stripeCheckoutSessionId: checkoutSession.id };
      await transaction.save();
    }
  }

  await promotion.save();

  let updatedPost = post;
  if (shouldActivateImmediately) {
    updatedPost = await activatePromotion(promotion._id, { paymentReference: promotion.paymentReference });
  }

  return {
    checkoutUrl: promotion.checkoutUrl || null,
    post: serializePost(updatedPost, user._id),
    promotion: promotion.toClient(),
    transactionId: String(transaction._id),
  };
}

async function activatePromotion(promotionId, options = {}) {
  const promotion = await FeedPromotion.findById(promotionId);
  if (!promotion) {
    const error = new Error("Feed promotion not found.");
    error.statusCode = 404;
    error.code = "PROMOTION_NOT_FOUND";
    throw error;
  }

  promotion.paymentStatus = "paid";
  promotion.state = "active";
  if (options.paymentReference) {
    promotion.paymentReference = String(options.paymentReference);
  }
  if (!promotion.startsAt) {
    promotion.startsAt = new Date();
  }
  if (!promotion.endsAt) {
    promotion.endsAt = addDays(promotion.startsAt, promotion.durationDays || DEFAULT_DURATION_DAYS);
  }
  await promotion.save();

  if (promotion.transactionId) {
    await Transaction.findByIdAndUpdate(promotion.transactionId, {
      $set: {
        referenceId: promotion.paymentReference || String(promotion._id),
        status: "success",
      },
    });
  }

  const promotedCountIncrement = options.wasAlreadyActive ? 0 : 1;
  const post = await FeedPost.findByIdAndUpdate(
    promotion.postId,
    {
      $inc: { "counters.promotedCount": promotedCountIncrement },
      $set: {
        isPromoted: true,
        promotion: {
          amount: promotion.amount,
          budgetClips: promotion.budgetClips,
          durationDays: promotion.durationDays,
          endsAt: promotion.endsAt,
          isPromoted: true,
          paymentReference: promotion.paymentReference,
          paymentStatus: promotion.paymentStatus,
          promotedByUserId: promotion.sponsorUserId,
          promotionId: promotion._id,
          spentClips: promotion.spentClips || 0,
          startsAt: promotion.startsAt,
          state: promotion.state,
          targeting: promotion.targeting || {},
        },
      },
    },
    { new: true }
  );

  const payload = {
    ok: true,
    post: post ? serializePost(post, options.currentUserId || promotion.sponsorUserId) : null,
    promotion: promotion.toClient(),
    transactionId: promotion.transactionId ? String(promotion.transactionId) : null,
  };

  const feedRealtimeService = getFeedRealtimeService();
  if (post) {
    const sponsor = await User.findById(promotion.sponsorUserId).select("_id avatar email handle name username");
    const notificationRecords = await createFeedPromotionNotification({
      actor: sponsor || { _id: promotion.sponsorUserId },
      data: { promotion: promotion.toClient(), promotionId: String(promotion._id), transactionId: promotion.transactionId ? String(promotion.transactionId) : null },
      post,
    });
    emitFeedNotificationRecords(feedRealtimeService?.io, notificationRecords);
  }

  if (feedRealtimeService && post) {
    feedRealtimeService.broadcastPromotionUpdated(promotion.postId, payload);
    feedRealtimeService.broadcastPostUpdated(promotion.postId, { ok: true, post: payload.post });
  }

  return post;
}

async function completePromotionPayment({ paymentReference, promotionId, provider = "manual", user, verifiedWebhook = false } = {}) {
  let promotion = null;
  if (promotionId && mongoose.Types.ObjectId.isValid(String(promotionId))) {
    promotion = await FeedPromotion.findById(promotionId);
  }

  if (!promotion && paymentReference) {
    promotion = await FeedPromotion.findOne({ paymentReference: String(paymentReference) });
  }

  if (!promotion) {
    const error = new Error("Feed promotion not found.");
    error.statusCode = 404;
    error.code = "PROMOTION_NOT_FOUND";
    throw error;
  }

  const isStripeWebhookCompletion = provider === "stripe" && verifiedWebhook;
  if (isProductionEnvironment() && !isStripeWebhookCompletion) {
    const error = new Error("Manual feed promotion completion is disabled in production.");
    error.statusCode = 403;
    error.code = "PROMOTION_MANUAL_COMPLETION_DISABLED";
    throw error;
  }

  if (!isStripeWebhookCompletion && user?._id) {
    const sponsorUserId = String(promotion.sponsorUserId || promotion.promotedByUserId || "");
    if (sponsorUserId !== String(user._id)) {
      const error = new Error("You can only complete your own feed promotion.");
      error.statusCode = 403;
      error.code = "PROMOTION_COMPLETION_FORBIDDEN";
      throw error;
    }
  }

  const wasAlreadyActive = promotion.state === "active" && promotion.paymentStatus === "paid";
  const post = await activatePromotion(promotion._id, {
    currentUserId: user?._id || promotion.sponsorUserId,
    paymentReference,
    provider,
    wasAlreadyActive,
  });

  const refreshedPromotion = await FeedPromotion.findById(promotion._id);
  return {
    post: post ? serializePost(post, refreshedPromotion.sponsorUserId) : null,
    promotion: refreshedPromotion.toClient(),
    transactionId: refreshedPromotion.transactionId ? String(refreshedPromotion.transactionId) : null,
  };
}

function verifyPromotionWebhookPayload({ body = {}, rawBody, signature } = {}) {
  const secret = getStripeWebhookSecret();

  if (!secret) {
    if (isProductionEnvironment()) {
      throw buildConfigError(
        "A Stripe webhook secret is required for production feed promotion webhook verification.",
      );
    }

    return body || {};
  }

  if (!signature) {
    const error = new Error("Missing Stripe webhook signature.");
    error.statusCode = 400;
    error.code = "STRIPE_WEBHOOK_SIGNATURE_REQUIRED";
    throw error;
  }

  if (!rawBody) {
    const error = new Error("Raw webhook body is required for Stripe webhook verification.");
    error.statusCode = 400;
    error.code = "STRIPE_WEBHOOK_RAW_BODY_REQUIRED";
    throw error;
  }

  const stripe = getStripeClient();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const verificationError = new Error("Invalid Stripe webhook signature.");
    verificationError.statusCode = 400;
    verificationError.code = "STRIPE_WEBHOOK_SIGNATURE_INVALID";
    verificationError.cause = error;
    throw verificationError;
  }
}

async function handlePaymentWebhook(payload = {}) {
  const eventType = payload.type || payload.eventType;
  const data = payload.data?.object || payload.data || payload;
  const metadata = data.metadata || payload.metadata || {};
  const promotionId = metadata.feedPromotionId || payload.feedPromotionId || payload.promotionId;
  const paymentReference = data.id || payload.paymentReference || payload.referenceId;
  const completed = ["checkout.session.completed", "payment_intent.succeeded", "feed_promotion.paid", "paid"].includes(eventType) || data.payment_status === "paid" || payload.status === "paid";

  if (!completed) {
    return { ignored: true, reason: "Payment event is not a completion event." };
  }

  return completePromotionPayment({ paymentReference, promotionId, provider: "stripe", verifiedWebhook: true });
}

module.exports = {
  activatePromotion,
  completePromotionPayment,
  createPromotionCheckout,
  handlePaymentWebhook,
  normalizeTargeting,
  validateFeedPromotionProductionConfig,
  verifyPromotionWebhookPayload,
};
