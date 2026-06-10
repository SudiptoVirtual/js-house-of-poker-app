const dotenv = require("dotenv");
const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const GameTable = require("../models/GameTable");
const { INTERNAL_GAME_TABLE_NOTES_PATTERN } = require("../utils/internalGameTables");

const OBSOLETE_DEFAULT_CHAT_ROOM_SLUGS = [
  "the-rail",
  "3-5-7-strategy",
  "low-stakes-lounge",
  "high-rollers",
  "new-players-room",
];

async function cleanupObsoleteChatData({ logger = console } = {}) {
  const [chatRoomResult, gameTableResult] = await Promise.all([
    ChatRoom.deleteMany({ slug: { $in: OBSOLETE_DEFAULT_CHAT_ROOM_SLUGS } }),
    GameTable.deleteMany({ notes: INTERNAL_GAME_TABLE_NOTES_PATTERN }),
  ]);

  const result = {
    deletedChatRooms: chatRoomResult.deletedCount || 0,
    deletedGameTables: gameTableResult.deletedCount || 0,
  };

  logger.log(
    `Deleted ${result.deletedChatRooms} obsolete default chat rooms and ${result.deletedGameTables} internal/demo game tables.`
  );

  return result;
}

async function run() {
  try {
    dotenv.config();
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required to clean obsolete chat data.");
    }

    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    await cleanupObsoleteChatData();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  OBSOLETE_DEFAULT_CHAT_ROOM_SLUGS,
  cleanupObsoleteChatData,
};
