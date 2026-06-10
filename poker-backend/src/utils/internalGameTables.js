const INTERNAL_GAME_TABLE_NOTES_PATTERN =
  /(?:training[-_\s]*bot[-_\s]*table|bot[-_\s]*training[-_\s]*table|(?:^|[-_\s])(?:internal(?:[-_\s]+demo)?|demo)(?:[-_\s]+game)?[-_\s]+table(?:$|[-_\s]))/i;

function buildExternalGameTableFilter() {
  return {
    notes: { $not: INTERNAL_GAME_TABLE_NOTES_PATTERN },
  };
}

module.exports = {
  INTERNAL_GAME_TABLE_NOTES_PATTERN,
  buildExternalGameTableFilter,
};
