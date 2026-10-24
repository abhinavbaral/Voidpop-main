// What Explore asks the VoidPop community: the verdict counts behind Best out there, Popular in town and Most loved.
// → { best, popular, loved } (communityRank.js), or null when there is no server or it can't be reached: the
// tiles then fall back (Popular in town, Most loved) or leave the row out (Best out there).
import { fetchRankings, hasCommunity } from "../api/community.js";
import { rankCommunity } from "./communityRank.js";
import { MIN_VERDICTS } from "./verdictMeter.js";

export async function loadCommunityRows() {
  if (!hasCommunity()) return null;
  try { return rankCommunity(await fetchRankings(MIN_VERDICTS)); } catch { return null; }
}
