const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');

function loadTableChatUtils() {
  const sourcePath = join(__dirname, '../../src/utils/tableChat.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  });

  const module = { exports: {} };
  const context = vm.createContext({
    exports: module.exports,
    module,
    require,
  });
  vm.runInContext(outputText, context, { filename: sourcePath });
  return module.exports;
}

function createMessage(index) {
  return {
    createdAt: index,
    id: `message-${index}`,
    moderation: {
      flags: [],
      reason: null,
      reviewedAt: null,
      status: 'accepted',
    },
    playerId: `player-${index}`,
    playerName: `Player ${index}`,
    text: `Message ${index}`,
    tone: 'player',
  };
}

const { appendTableChatMessage, getVisibleTableChatMessages, TABLE_CHAT_HISTORY_LIMIT } =
  loadTableChatUtils();

const tests = [
  [
    'visible ticker/popover messages use the newest three messages in oldest-to-newest order',
    () => {
      const messages = [1, 2, 3, 4, 5].map(createMessage);

      assert.deepEqual(
        getVisibleTableChatMessages(messages).map((message) => message.text),
        ['Message 3', 'Message 4', 'Message 5'],
      );
    },
  ],
  [
    'appending table chat messages preserves oldest-to-newest history and trims old entries',
    () => {
      const messages = Array.from(
        { length: TABLE_CHAT_HISTORY_LIMIT + 1 },
        (_, index) => createMessage(index + 1),
      );
      const nextHistory = appendTableChatMessage(messages, createMessage(TABLE_CHAT_HISTORY_LIMIT + 2));

      assert.equal(nextHistory.length, TABLE_CHAT_HISTORY_LIMIT);
      assert.equal(nextHistory.at(0).text, 'Message 3');
      assert.equal(nextHistory.at(-1).text, `Message ${TABLE_CHAT_HISTORY_LIMIT + 2}`);
    },
  ],
];

let failures = 0;

tests.forEach(([name, fn]) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
});

if (failures > 0) {
  process.exitCode = 1;
}
