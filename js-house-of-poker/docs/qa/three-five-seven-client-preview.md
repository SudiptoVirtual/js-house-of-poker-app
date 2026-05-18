# 357 client preview QA fixtures and checklist

Use this checklist before the next client preview. The deterministic scenario data lives in `server/tests/fixtures/threeFiveSevenQaScenarios.js` and is validated by `npm run test:357:qa-fixtures`.

## Required deterministic scenarios

All scenarios use the same seven seated players (`seatIndex` 0 through 6), a $1 357 table, a 1-clip ante, a 2-clip loser payment to the winner side, and a 2-clip loser payment to the pot.

| Fixture ID | What to validate | Expected result |
| --- | --- | --- |
| `357-seven-seated-opening-state` | Seven occupied seats render compactly around the lowered table before a reveal. | Seven compact player indicators are visible and the pot starts at 7 clips. |
| `357-solo-go-earns-one-leg` | Exactly one GO player reveals GO. | Ari wins the 7-clip pot and only Ari earns +1 leg. |
| `357-two-go-one-winner-loser-pays-winner-and-pot` | Ari and Blake reveal GO; Ari's hand beats Blake's. | Blake pays 2 clips to Ari and 2 clips to the pot; the pot becomes 9 clips. |
| `357-three-go-one-winner` | Ari, Blake, and Casey reveal GO; Ari beats both. | Blake and Casey each pay 2 clips to Ari and 2 clips to the pot; Ari receives 4 clips and the pot becomes 11 clips. |
| `357-tied-go-winners-split-loser-payments` | Ari and Blake tie as GO winners over Casey. | Casey's 2-clip winner-side payment splits 1/1 between Ari and Blake, and Casey also pays 2 clips to the pot. |
| `357-no-go-pot-carries` | All seven players reveal STAY. | Nobody is paid, nobody earns a leg, and the 7-clip pot carries forward. |

## Manual UI checklist

Capture screenshots or screen recordings for each item below while stepping through the fixture sequence above.

1. **Compact player indicators**
   - Load `357-seven-seated-opening-state`.
   - Confirm all seven seats fit without overlapping the center board, pot, or action controls.
   - Confirm each indicator still shows name, stack/clip context, leg count, and current decision status when available.

2. **Lowered table**
   - With all seven seats visible, confirm the table surface sits low enough to leave the top rail readable.
   - Verify player cards and the center board remain within the table boundary at phone and tablet widths.

3. **Slim horizontal chat/invite strip**
   - Open the table chat/invite area.
   - Confirm the strip stays horizontal and slim, does not push the table offscreen, and keeps invite targets scannable.
   - Send or queue one invite and verify the strip still preserves the table layout.

4. **Right-side GO/STAY**
   - Enter a 357 decision round from any fixture with pending decisions.
   - Confirm GO/STAY controls sit on the right side, are reachable, and do not cover seat 6 or the result summary.
   - Confirm a locked decision visually changes state and cannot be changed during the same round.

5. **Visible rule/stipulation badge**
   - Check both `HOSTEST` and `BEST_FIVE` fixtures.
   - Confirm the rule/stipulation badge is visible above the felt and names the active wild rule (`3 wild`, `7 wild`, or cumulative wilds).
   - Confirm the badge remains visible after opening chat/invite controls.

6. **GO card reveal**
   - Use `357-solo-go-earns-one-leg`, then repeat with a multi-GO fixture.
   - Confirm GO/STAY decisions reveal together and GO cards are visually emphasized.
   - Confirm STAY players are still identifiable but do not appear as showdown winners.

7. **Result summary showing who beat whom**
   - Use `357-two-go-one-winner-loser-pays-winner-and-pot` and `357-three-go-one-winner`.
   - Confirm the summary states who beat whom, the winning hand text, and the loser payments to both winner side and pot.
   - Use `357-tied-go-winners-split-loser-payments` and confirm the summary says the tied winners split the loser payment.
   - Use `357-no-go-pot-carries` and confirm the summary says the pot carries forward.

## Preview gate

Before sending the next client preview:

1. Run `npm run test:357:all` from `js-house-of-poker/`.
2. Load or manually mirror each fixture in `server/tests/fixtures/threeFiveSevenQaScenarios.js`.
3. Attach screenshots or recordings for every checklist item above to the preview notes.
4. Do not send the preview until every expected result in the table above is observed or explicitly documented as a known issue.
