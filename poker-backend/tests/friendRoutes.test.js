const assert = require("node:assert/strict");
const test = require("node:test");

const friendRoutes = require("../src/routes/friendRoutes");

function getRoute(path) {
  return friendRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods.get);
}

test("canonical and legacy friend-list routes use the same protected handler chain", () => {
  const canonicalRoute = getRoute("/");
  const legacyRoute = getRoute("/list");

  assert.ok(canonicalRoute, "GET / should be registered as the canonical friend-list route");
  assert.ok(legacyRoute, "GET /list should remain available for backwards compatibility");
  assert.deepEqual(
    canonicalRoute.route.stack.map((layer) => layer.handle),
    legacyRoute.route.stack.map((layer) => layer.handle)
  );
});


test("DELETE /:userId uses the protected remove-friend handler chain", () => {
  const deleteRoute = friendRoutes.stack.find((layer) => layer.route?.path === "/:userId" && layer.route.methods.delete);

  assert.ok(deleteRoute, "DELETE /:userId should be registered for removing friends");
  assert.equal(deleteRoute.route.stack.length, 2);
});
