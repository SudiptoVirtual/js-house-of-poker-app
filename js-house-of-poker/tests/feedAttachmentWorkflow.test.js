const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/components/feed/attachmentWorkflow.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename)); compiled._compile(output, filename);
const { appendFeedAttachments, MAX_FEED_ATTACHMENTS, removeFeedAttachment, uploadAttachmentsAndCreatePost } = compiled.exports;
const attachment = (id) => ({ id, mimeType: 'image/jpeg', name: `${id}.jpg`, type: 'image', uri: `file://${id}.jpg` });

test('selected attachments are appended up to the attachment limit and removable', () => {
  const selected = appendFeedAttachments([], ['1', '2', '3', '4', '5', '6'].map(attachment));
  assert.equal(MAX_FEED_ATTACHMENTS, 5);
  assert.deepEqual(selected.map(({ id }) => id), ['1', '2', '3', '4', '5']);
  assert.deepEqual(removeFeedAttachment(selected, '1').map(({ id }) => id), ['2', '3', '4', '5']);
});
test('upload failure prevents post submission', async () => {
  let submitted = false;
  await assert.rejects(() => uploadAttachmentsAndCreatePost([attachment('1')], 'draft', async () => { throw new Error('upload failed'); }, async () => { submitted = true; }));
  assert.equal(submitted, false);
});
test('successful uploads submit trimmed content and durable media metadata', async () => {
  let input;
  const media = { mimeType: 'image/jpeg', type: 'image', url: 'https://example.com/a.jpg' };
  await uploadAttachmentsAndCreatePost([attachment('1')], '  hello  ', async () => media, async (value) => { input = value; });
  assert.deepEqual(input, { content: 'hello', media: [media] });
});
