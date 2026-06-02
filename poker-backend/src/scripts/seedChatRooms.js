const dotenv = require("dotenv");
const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");

const DEFAULT_CHAT_ROOMS = [
  {
    name: "The Rail",
    slug: "the-rail",
    topic: "Casual table planning",
    description: "Coordinate casual free-play tables and find open seats with regulars.",
    visibility: "public",
    sortOrder: 10,
  },
  {
    name: "3-5-7 Strategy",
    slug: "3-5-7-strategy",
    topic: "3-5-7 strategy and hand review",
    description: "Talk through 3-5-7 lines, drills, and training-table etiquette before jumping in.",
    visibility: "public",
    sortOrder: 20,
  },
  {
    name: "Low Stakes Lounge",
    slug: "low-stakes-lounge",
    topic: "Low-stakes games and beginner-friendly tables",
    description: "Find relaxed low-stakes tables, share player introductions, and plan friendly sessions.",
    visibility: "public",
    sortOrder: 30,
  },
  {
    name: "High Rollers",
    slug: "high-rollers",
    topic: "Big-stack table coordination",
    description: "Coordinate higher-stakes play-chip tables and discuss advanced game flow with regulars.",
    visibility: "public",
    sortOrder: 40,
  },
  {
    name: "New Players Room",
    slug: "new-players-room",
    topic: "New-player onboarding and questions",
    description: "Ask questions, learn table etiquette, and meet players before your first live table.",
    visibility: "public",
    sortOrder: 50,
  },
];

function buildSeedOperation(room) {
  return {
    updateOne: {
      filter: { slug: room.slug },
      update: {
        $setOnInsert: {
          activePlayerCount: 0,
          description: room.description,
          isPublic: room.visibility === "public",
          lastMessageAt: null,
          lastMessagePreview: "",
          name: room.name,
          participantStates: [],
          slug: room.slug,
          sortOrder: room.sortOrder,
          tableInviteHistory: [],
          tableLaunches: [],
          topic: room.topic,
          visibility: room.visibility,
        },
      },
      upsert: true,
    },
  };
}

async function seedChatRooms({ logger = console } = {}) {
  const operations = DEFAULT_CHAT_ROOMS.map(buildSeedOperation);

  if (operations.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, rooms: [] };
  }

  const result = await ChatRoom.bulkWrite(operations, { ordered: true });
  const rooms = await ChatRoom.find({ slug: { $in: DEFAULT_CHAT_ROOMS.map((room) => room.slug) } })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  logger.log(
    `Seeded ${rooms.length} default chat rooms (${result.upsertedCount || 0} inserted, ${
      result.modifiedCount || 0
    } updated).`
  );

  return {
    matchedCount: result.matchedCount || 0,
    modifiedCount: result.modifiedCount || 0,
    upsertedCount: result.upsertedCount || 0,
    rooms,
  };
}

async function run() {
  try {
    dotenv.config();
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required to seed chat rooms.");
    }

    await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
    await seedChatRooms();
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
  DEFAULT_CHAT_ROOMS,
  buildSeedOperation,
  seedChatRooms,
};
