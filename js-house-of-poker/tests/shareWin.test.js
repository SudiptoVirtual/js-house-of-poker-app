const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadShareWin() {
  const filename = path.resolve(__dirname, '../src/utils/shareWin.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); return mod.exports;
}
const win = { gameType: 'holdem', handId: 'table-1:12', handNumber: 12, potValue: 2500, resultLabel: 'Alex wins 2,500 chips', tableCode: 'TABLE1', tableId: null, tableName: 'Friday Night', winnerIds: ['player-1'] };
const player = { id: 'player-1', userId: 'user-1' };

test('winner eligibility requires the authenticated account and winning player id', () => {
  const { isAuthenticatedWinner } = loadShareWin();
  assert.equal(isAuthenticatedWinner(win, player, 'user-1'), true);
  assert.equal(isAuthenticatedWinner(win, player, 'user-2'), false);
  assert.equal(isAuthenticatedWinner({ ...win, winnerIds: ['player-2'] }, player, 'user-1'), false);
});

test('Share Win payload serializes stable game and table context', () => {
  const { buildShareWinPostInput } = loadShareWin();
  assert.deepEqual(buildShareWinPostInput(win, ' Great hand! '), {
    content: 'Great hand!', gameContext: { gameType: 'holdem', handId: 'table-1:12', handNumber: 12, headline: 'Shared a table win', resultLabel: 'Alex wins 2,500 chips', stakesLabel: '2,500 chip pot', tableName: 'Friday Night' },
    postKind: 'share-win', tableCode: 'TABLE1', tableContext: { gameLabel: 'holdem', tableCode: 'TABLE1', tableName: 'Friday Night' },
  });
});
