function userCanAccessChatRoom(room, userId) {
  if (room.isPublic !== false) {
    return true;
  }

  const userIdString = String(userId);
  const isCreator = room.createdByUserId && String(room.createdByUserId) === userIdString;
  const isParticipant = (room.participantStates || []).some(
    (state) => String(state.userId) === userIdString
  );

  return Boolean(isCreator || isParticipant);
}

function assertUserCanAccessChatRoom(room, userId, message = "You are not allowed to invite players from this chat room.") {
  if (!userCanAccessChatRoom(room, userId)) {
    throw new Error(message);
  }
}

module.exports = {
  assertUserCanAccessChatRoom,
  userCanAccessChatRoom,
};
