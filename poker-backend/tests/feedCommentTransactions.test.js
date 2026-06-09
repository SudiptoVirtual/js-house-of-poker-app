const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FeedComment = require("../src/models/FeedComment");
const FeedPost = require("../src/models/FeedPost");
const FeedReaction = require("../src/models/FeedReaction");
const { addComment, deleteComment } = require("../src/controllers/feedController");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function unsupportedTransactionError() {
  return Object.assign(
    new Error("Transaction numbers are only allowed on a replica set member or mongos"),
    { code: 20, codeName: "IllegalOperation" },
  );
}

function makeComment({ authorUserId, body = "Nice hand", id, postId }) {
  return {
    _id: id,
    authorSnapshot: { handle: "@player", name: "Player", status: "Online" },
    authorUserId,
    body,
    createdAt: new Date("2026-06-09T00:00:00.000Z"),
    deletedAt: null,
    moderation: { status: "accepted" },
    parentCommentId: null,
    postId,
    toClient: FeedComment.schema.methods.toClient,
  };
}

function makePost({ authorUserId, commentCount = 0, id }) {
  return {
    _id: id,
    authorUserId,
    counters: { commentCount, reactionCounts: new Map(), supportersCount: 0 },
    moderation: { status: "accepted" },
    status: "published",
    visibility: "public",
    toClient() {
      return { commentCount: this.counters.commentCount, id: String(this._id) };
    },
  };
}

function createSession() {
  return {
    abortCalls: 0,
    commitCalls: 0,
    endCalls: 0,
    startCalls: 0,
    async abortTransaction() { this.abortCalls += 1; },
    async commitTransaction() { this.commitCalls += 1; },
    async endSession() { this.endCalls += 1; },
    startTransaction() { this.startCalls += 1; },
  };
}

function reactionQuery() {
  return {
    session() { return this; },
    async select() { return []; },
  };
}

function visiblePostQuery(post, { rejectInSession = false } = {}) {
  return {
    session(session) {
      if (session && rejectInSession) {
        return Promise.reject(unsupportedTransactionError());
      }
      return Promise.resolve(post);
    },
  };
}

async function withFeedMocks(options, callback) {
  const originals = {
    commentCountDocuments: FeedComment.countDocuments,
    commentCreate: FeedComment.create,
    commentDeleteOne: FeedComment.deleteOne,
    commentFindOne: FeedComment.findOne,
    postFindOne: FeedPost.findOne,
    postFindOneAndUpdate: FeedPost.findOneAndUpdate,
    reactionFind: FeedReaction.find,
    startSession: mongoose.startSession,
  };
  const session = createSession();
  const comments = options.comments || [];
  const post = options.post;
  let transactionCreateAttempts = 0;

  mongoose.startSession = async () => session;
  FeedReaction.find = () => reactionQuery();
  FeedPost.findOne = () => visiblePostQuery(post, { rejectInSession: options.rejectReadInTransaction });
  FeedComment.countDocuments = async () => comments.filter((comment) => !comment.deletedAt).length;
  FeedComment.create = async ([data], createOptions) => {
    if (createOptions?.session) {
      transactionCreateAttempts += 1;
      if (options.transactionCreateError) throw options.transactionCreateError;
      if (options.rejectCreateInTransaction) throw unsupportedTransactionError();
    }
    const comment = makeComment({ ...data, id: objectId(String(comments.length + 100)), postId: data.postId });
    comments.push(comment);
    return [comment];
  };
  FeedComment.deleteOne = async ({ _id }) => {
    const index = comments.findIndex((comment) => String(comment._id) === String(_id));
    if (index >= 0) comments.splice(index, 1);
  };
  FeedComment.findOne = ({ _id, deletedAt, postId }) => {
    const find = () => comments.find((comment) => (
      String(comment._id) === String(_id) &&
      String(comment.postId) === String(postId) &&
      comment.deletedAt === deletedAt
    )) || null;
    return {
      session: async () => find(),
      then(resolve, reject) { return Promise.resolve(find()).then(resolve, reject); },
    };
  };
  FeedPost.findOneAndUpdate = async (_filter, update, updateOptions) => {
    if (options.failFallbackCounterUpdate && !updateOptions?.session && update.$inc?.["counters.commentCount"] === 1) {
      throw new Error("counter update failed");
    }
    if (options.failFallbackDeleteCounterUpdate && !updateOptions?.session && Array.isArray(update)) {
      throw new Error("counter update failed");
    }
    if (update.$inc?.["counters.commentCount"]) {
      post.counters.commentCount += update.$inc["counters.commentCount"];
    } else if (update.$set?.["counters.commentCount"] !== undefined) {
      post.counters.commentCount = update.$set["counters.commentCount"];
    } else if (Array.isArray(update)) {
      post.counters.commentCount = Math.max(0, post.counters.commentCount - 1);
    }
    return post;
  };

  try {
    await callback({ comments, post, session, transactionCreateAttempts: () => transactionCreateAttempts });
  } finally {
    mongoose.startSession = originals.startSession;
    FeedReaction.find = originals.reactionFind;
    FeedPost.findOne = originals.postFindOne;
    FeedPost.findOneAndUpdate = originals.postFindOneAndUpdate;
    FeedComment.countDocuments = originals.commentCountDocuments;
    FeedComment.create = originals.commentCreate;
    FeedComment.deleteOne = originals.commentDeleteOne;
    FeedComment.findOne = originals.commentFindOne;
  }
}

function addRequest(postId, userId) {
  return {
    body: { comment: "Nice hand" },
    params: { postId: String(postId) },
    user: { _id: userId, email: "player@example.com", name: "Player" },
  };
}

test("addComment creates a comment in one supported transaction", async () => {
  const userId = objectId("1");
  const post = makePost({ authorUserId: userId, id: objectId("2") });

  await withFeedMocks({ post }, async ({ comments, session }) => {
    const response = createResponse();
    await addComment(addRequest(post._id, userId), response);

    assert.equal(response.statusCode, 201);
    assert.equal(comments.length, 1);
    assert.equal(post.counters.commentCount, 1);
    assert.equal(session.startCalls, 1);
    assert.equal(session.commitCalls, 1);
    assert.equal(session.abortCalls, 0);
  });
});

test("addComment falls back once on transaction-unsupported MongoDB without duplicate comments", async () => {
  const userId = objectId("3");
  const post = makePost({ authorUserId: userId, id: objectId("4") });

  await withFeedMocks({ post, rejectCreateInTransaction: true }, async ({ comments, session, transactionCreateAttempts }) => {
    const response = createResponse();
    await addComment(addRequest(post._id, userId), response);

    assert.equal(response.statusCode, 201);
    assert.equal(transactionCreateAttempts(), 1);
    assert.equal(comments.length, 1);
    assert.equal(post.counters.commentCount, 1);
    assert.equal(session.abortCalls, 1);
    assert.equal(session.commitCalls, 0);
  });
});

test("addComment compensates the fallback comment when its counter update fails", async () => {
  const userId = objectId("5");
  const post = makePost({ authorUserId: userId, id: objectId("6") });

  await withFeedMocks({ failFallbackCounterUpdate: true, post, rejectCreateInTransaction: true }, async ({ comments }) => {
    const response = createResponse();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await addComment(addRequest(post._id, userId), response);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.statusCode, 500);
    assert.equal(comments.length, 0);
    assert.equal(post.counters.commentCount, 0);
  });
});


test("addComment does not replay non-capability transaction failures through fallback", async () => {
  const userId = objectId("13");
  const post = makePost({ authorUserId: userId, id: objectId("14") });

  await withFeedMocks({ post, transactionCreateError: new Error("write conflict") }, async ({ comments, session }) => {
    const response = createResponse();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await addComment(addRequest(post._id, userId), response);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.statusCode, 500);
    assert.equal(comments.length, 0);
    assert.equal(post.counters.commentCount, 0);
    assert.equal(session.abortCalls, 1);
  });
});

test("deleteComment falls back on standalone MongoDB and keeps commentCount consistent", async () => {
  const userId = objectId("7");
  const post = makePost({ authorUserId: userId, commentCount: 1, id: objectId("8") });
  const comment = makeComment({ authorUserId: userId, id: objectId("9"), postId: post._id });
  comment.save = async () => comment;

  await withFeedMocks({ comments: [comment], post, rejectReadInTransaction: true }, async ({ session }) => {
    const response = createResponse();
    await deleteComment(
      { params: { commentId: String(comment._id), postId: String(post._id) }, user: { _id: userId } },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.deleted, true);
    assert.ok(comment.deletedAt instanceof Date);
    assert.equal(post.counters.commentCount, 0);
    assert.equal(session.abortCalls, 1);
  });
});


test("deleteComment restores the fallback comment when its counter update fails", async () => {
  const userId = objectId("10");
  const post = makePost({ authorUserId: userId, commentCount: 1, id: objectId("11") });
  const comment = makeComment({ authorUserId: userId, id: objectId("12"), postId: post._id });
  comment.save = async () => comment;

  await withFeedMocks({
    comments: [comment],
    failFallbackDeleteCounterUpdate: true,
    post,
    rejectReadInTransaction: true,
  }, async () => {
    const response = createResponse();
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await deleteComment(
        { params: { commentId: String(comment._id), postId: String(post._id) }, user: { _id: userId } },
        response,
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.statusCode, 500);
    assert.equal(comment.deletedAt, null);
    assert.equal(post.counters.commentCount, 1);
  });
});
