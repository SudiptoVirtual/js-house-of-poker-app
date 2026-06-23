const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function compileService() {
  const filename = path.resolve(__dirname, '../src/services/notifications/feedNotificationService.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = new Module(filename, module);
  const originalLoad = compiledModule.require.bind(compiledModule);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule.require = (request) => {
    if (request === '../../constants/routes') {
      return { routes: { Feed: 'Feed', Game: 'Game' } };
    }
    if (request === '../feed/feedRealtimeClient') {
      return { createFeedRealtimeClient: () => ({ connect: async () => {}, destroy: () => {} }) };
    }
    return originalLoad(request);
  };
  compiledModule._compile(output, filename);
  return compiledModule.exports;
}

test('table player joined notifications map to the game table banner route', () => {
  const { mapFeedNotificationPayload } = compileService();
  const notification = mapFeedNotificationPayload(
    {
      notification: {
        body: 'Joiner joined Host Table.',
        data: {
          actorDisplayName: 'Joiner',
          tableCode: 'JOIN9',
          tableName: 'Host Table',
        },
        id: 'notification-1',
        title: 'Player joined your table',
        type: 'table_player_joined',
      },
      preview: 'Joiner joined Host Table.',
      type: 'table_player_joined',
      unreadCount: 1,
    },
    'notification:new',
  );

  assert.equal(notification.type, 'table_player_joined');
  assert.equal(notification.label, 'Table joined');
  assert.equal(notification.ctaLabel, 'Open table');
  assert.equal(notification.navigationTarget.route, 'Game');
  assert.equal(notification.navigationTarget.params.gameId, 'JOIN9');
  assert.equal(notification.navigationTarget.params.tableCode, 'JOIN9');
});
