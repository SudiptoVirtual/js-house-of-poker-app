const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadConfirmations(alertCalls) {
  const filename = path.resolve(__dirname, '../src/components/confirmDestructiveAction.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = new Module(filename, module);
  const originalLoad = compiledModule.require.bind(compiledModule);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule.require = (request) => request === 'react-native'
    ? { Alert: { alert: (...args) => alertCalls.push(args) } }
    : originalLoad(request);
  compiledModule._compile(output, filename);
  return compiledModule.exports;
}

function pressButton(buttons, text) {
  buttons.find((button) => button.text === text)?.onPress?.();
}

test('leave-room confirmation cancellation makes no request and confirmation invokes the leave handler', () => {
  const alertCalls = [];
  const leaveRequests = [];
  const { confirmLeaveChatRoom } = loadConfirmations(alertCalls);

  confirmLeaveChatRoom('Friday Night Poker', () => leaveRequests.push('leave-room'));

  const [title, message, buttons] = alertCalls[0];
  assert.equal(title, 'Leave chat room?');
  assert.match(message, /Friday Night Poker/);
  assert.deepEqual(buttons.map(({ style, text }) => ({ style, text })), [
    { style: 'cancel', text: 'Cancel' },
    { style: 'destructive', text: 'Leave room' },
  ]);

  pressButton(buttons, 'Cancel');
  assert.deepEqual(leaveRequests, []);

  pressButton(buttons, 'Leave room');
  assert.deepEqual(leaveRequests, ['leave-room']);
});

test('remove-friend confirmation cancellation makes no request and confirmation invokes the remove handler', () => {
  const alertCalls = [];
  const removeRequests = [];
  const { confirmRemoveFriend } = loadConfirmations(alertCalls);

  confirmRemoveFriend('Sam Sender', () => removeRequests.push('remove-friend'));

  const [title, message, buttons] = alertCalls[0];
  assert.equal(title, 'Remove friend?');
  assert.match(message, /Sam Sender/);
  assert.deepEqual(buttons.map(({ style, text }) => ({ style, text })), [
    { style: 'cancel', text: 'Cancel' },
    { style: 'destructive', text: 'Remove friend' },
  ]);

  pressButton(buttons, 'Cancel');
  assert.deepEqual(removeRequests, []);

  pressButton(buttons, 'Remove friend');
  assert.deepEqual(removeRequests, ['remove-friend']);
});
