const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const mongoose = require('mongoose');

const FeedPost = require('../src/models/FeedPost');
const FeedPromotion = require('../src/models/FeedPromotion');
const Transaction = require('../src/models/Transaction');
const User = require('../src/models/User');
const {
  completePromotionPayment,
  handlePaymentWebhook,
  validateFeedPromotionProductionConfig,
} = require('../src/services/feedPromotionService');

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, '0'));
}

function createPromotion(overrides = {}) {
  const promotion = {
    _id: objectId('100'),
    amount: 1000,
    budgetClips: 1000,
    durationDays: 7,
    paymentReference: 'cs_test_123',
    paymentStatus: 'pending',
    postId: objectId('101'),
    saveCalls: 0,
    sponsorUserId: objectId('102'),
    state: 'pending',
    targeting: {},
    transactionId: objectId('103'),
    async save() {
      this.saveCalls += 1;
      return this;
    },
    toClient() {
      return {
        id: String(this._id),
        paymentReference: this.paymentReference,
        paymentStatus: this.paymentStatus,
        sponsorUserId: String(this.sponsorUserId),
        state: this.state,
        transactionId: this.transactionId ? String(this.transactionId) : null,
      };
    },
    ...overrides,
  };
  return promotion;
}

const productionConfigEnvKeys = [
  'FEED_PROMOTION_PAYMENT_PROVIDER',
  'STRIPE_SECRET_KEY',
  'FEED_PROMOTION_SUCCESS_URL',
  'FEED_PROMOTION_CANCEL_URL',
  'FEED_PROMOTION_STRIPE_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SECRET',
];

const originals = {
  env: process.env.NODE_ENV,
  productionConfigEnv: Object.fromEntries(
    productionConfigEnvKeys.map((key) => [key, process.env[key]]),
  ),
  findById: FeedPromotion.findById,
  findOne: FeedPromotion.findOne,
  postFindByIdAndUpdate: FeedPost.findByIdAndUpdate,
  transactionFindByIdAndUpdate: Transaction.findByIdAndUpdate,
  userFindById: User.findById,
};

afterEach(() => {
  process.env.NODE_ENV = originals.env;
  for (const key of productionConfigEnvKeys) {
    if (originals.productionConfigEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originals.productionConfigEnv[key];
    }
  }
  FeedPromotion.findById = originals.findById;
  FeedPromotion.findOne = originals.findOne;
  FeedPost.findByIdAndUpdate = originals.postFindByIdAndUpdate;
  Transaction.findByIdAndUpdate = originals.transactionFindByIdAndUpdate;
  User.findById = originals.userFindById;
});

function stubActivationPersistence(promotion, activationCalls = []) {
  FeedPromotion.findById = async () => promotion;
  FeedPromotion.findOne = async () => promotion;
  FeedPost.findByIdAndUpdate = async (postId, update) => {
    activationCalls.push({ postId, update });
    return {
      _id: postId,
      toClient: ({ currentUserId } = {}) => ({ id: String(postId), currentUserId: String(currentUserId) }),
    };
  };
  Transaction.findByIdAndUpdate = async () => null;
  User.findById = () => ({ select: async () => ({ _id: promotion.sponsorUserId }) });
}


test('production config validation rejects missing Stripe feed promotion settings', () => {
  process.env.NODE_ENV = 'production';
  for (const key of productionConfigEnvKeys) {
    delete process.env[key];
  }

  assert.throws(
    () => validateFeedPromotionProductionConfig(),
    (error) => {
      assert.equal(error.statusCode, 500);
      assert.equal(error.code, 'FEED_PROMOTION_CONFIG_ERROR');
      assert.match(error.message, /FEED_PROMOTION_PAYMENT_PROVIDER=stripe/);
      assert.match(error.message, /STRIPE_SECRET_KEY/);
      assert.match(error.message, /FEED_PROMOTION_SUCCESS_URL/);
      assert.match(error.message, /FEED_PROMOTION_CANCEL_URL/);
      assert.match(error.message, /FEED_PROMOTION_STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET/);
      return true;
    },
  );
});

test('production rejects manual feed promotion completion before activation', async () => {
  process.env.NODE_ENV = 'production';
  const promotion = createPromotion();
  const activationCalls = [];
  stubActivationPersistence(promotion, activationCalls);

  await assert.rejects(
    () => completePromotionPayment({
      paymentReference: 'cs_test_123',
      promotionId: promotion._id,
      provider: 'manual',
      user: { _id: promotion.sponsorUserId },
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'PROMOTION_MANUAL_COMPLETION_DISABLED');
      return true;
    },
  );

  assert.equal(promotion.state, 'pending');
  assert.equal(promotion.paymentStatus, 'pending');
  assert.equal(promotion.saveCalls, 0);
  assert.equal(activationCalls.length, 0);
});

test('non-owner cannot complete another sponsor promotion outside production', async () => {
  process.env.NODE_ENV = 'test';
  const promotion = createPromotion({ sponsorUserId: objectId('201') });
  const activationCalls = [];
  stubActivationPersistence(promotion, activationCalls);

  await assert.rejects(
    () => completePromotionPayment({
      paymentReference: 'cs_test_123',
      promotionId: promotion._id,
      provider: 'manual',
      user: { _id: objectId('202') },
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'PROMOTION_COMPLETION_FORBIDDEN');
      return true;
    },
  );

  assert.equal(promotion.state, 'pending');
  assert.equal(promotion.paymentStatus, 'pending');
  assert.equal(promotion.saveCalls, 0);
  assert.equal(activationCalls.length, 0);
});

test('verified Stripe webhook completion still activates promotion in production', async () => {
  process.env.NODE_ENV = 'production';
  const promotion = createPromotion({ sponsorUserId: objectId('301') });
  const activationCalls = [];
  stubActivationPersistence(promotion, activationCalls);

  const result = await handlePaymentWebhook({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        metadata: { feedPromotionId: String(promotion._id) },
        payment_status: 'paid',
      },
    },
  });

  assert.equal(promotion.state, 'active');
  assert.equal(promotion.paymentStatus, 'paid');
  assert.equal(promotion.saveCalls, 1);
  assert.equal(activationCalls.length, 1);
  assert.equal(result.promotion.state, 'active');
});
