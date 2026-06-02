function mapRealtimeError(error) {
  const message = error instanceof Error ? error.message : "Unexpected realtime error.";
  const errorName = error instanceof Error ? error.name : "";

  if (message === "Authentication token is required for realtime play.") {
    return {
      code: "AUTH_REQUIRED",
      message: "Please sign in again to join or create a realtime table.",
    };
  }

  if (errorName === "TokenExpiredError" || message === "jwt expired") {
    return {
      code: "AUTH_EXPIRED",
      message: "Your session has expired. Please sign in again.",
    };
  }

  if (
    errorName === "JsonWebTokenError" ||
    errorName === "NotBeforeError" ||
    message === "Invalid player token."
  ) {
    return {
      code: "AUTH_INVALID",
      message: "Your session is no longer valid. Please sign in again.",
    };
  }

  return { code: "REALTIME_ERROR", message };
}

function withSocketErrorBoundary(socket, handler) {
  Promise.resolve()
    .then(handler)
    .catch((error) => {
      const payload = mapRealtimeError(error);
      socket.emit("table:error", payload);
      socket.emit("room:error", payload);
    });
}

module.exports = {
  mapRealtimeError,
  withSocketErrorBoundary,
};
