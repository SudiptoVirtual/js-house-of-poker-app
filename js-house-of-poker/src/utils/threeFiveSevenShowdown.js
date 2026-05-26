function get357ShowdownStageLabel(stage) {
  if (stage === 'THREE_CARD') return '3-CARD SHOWDOWN';
  if (stage === 'FIVE_CARD') return '5-CARD SHOWDOWN';
  if (stage === 'SEVEN_CARD') return 'SEVEN CARD FINAL SHOWDOWN';
  return 'SHOWDOWN';
}

function inferStageFromResolution(resolution) {
  const candidate = Object.values(resolution?.showdownDescriptions ?? {})[0] ?? '';
  const normalized = String(candidate).toLowerCase();
  if (normalized.includes('7-card')) return 'SEVEN_CARD';
  if (normalized.includes('five') || normalized.includes('5-card')) return 'FIVE_CARD';
  if (normalized.includes('three') || normalized.includes('3-card')) return 'THREE_CARD';
  return null;
}

function build357ShowdownPanelViewModel(variantState, players) {
  const resolution = variantState?.lastResolution ?? null;
  const winnerId = resolution?.winnerIds?.[0] ?? null;
  const winnerName = players.find((player) => player.id === winnerId)?.name ?? 'N/A';
  const stage = inferStageFromResolution(resolution);
  const winningHandName = winnerId ? resolution?.showdownDescriptions?.[winnerId] ?? 'N/A' : 'N/A';
  const activePlayersRemaining = resolution?.goPlayerIds?.length ?? 0;
  const legDelta = winnerId ? resolution?.legDeltaByPlayerId?.[winnerId] ?? 0 : 0;

  return {
    stageLabel: get357ShowdownStageLabel(stage),
    winningHandName,
    handRankExplanation:
      winningHandName !== 'N/A'
        ? `${winnerName} takes ${get357ShowdownStageLabel(stage).toLowerCase()} with ${winningHandName}.`
        : 'Waiting for GO showdown evaluation.',
    legGainLoss: legDelta,
    potBefore: resolution?.potBeforeResolution ?? 0,
    potAfter: resolution?.potAfterResolution ?? variantState?.pot ?? 0,
    potDelta: (resolution?.potAfterResolution ?? variantState?.pot ?? 0) - (resolution?.potBeforeResolution ?? 0),
    activePlayersRemaining,
  };
}

module.exports = {
  build357ShowdownPanelViewModel,
  get357ShowdownStageLabel,
};
