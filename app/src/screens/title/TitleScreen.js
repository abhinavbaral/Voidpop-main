// The "Detail" route: anime and manga use the tracker page (DetailScreen),
// movies and series use the verdict page (CinemaDetailScreen), games and comics have their own (GameComicDetailScreen).
import { isCinema } from "@voidpop/shared/api/tmdb";
import { isShelf } from "@voidpop/shared/features/shelfKinds";
import DetailScreen from "./DetailScreen.js";
import CinemaDetailScreen from "../cinema/CinemaDetailScreen.js";
import GameComicDetailScreen from "../shelf/GameComicDetailScreen.js";

export default function TitleScreen(props) {
  const segment = props.route?.params?.segment;
  if (isShelf(segment)) return <GameComicDetailScreen {...props} />;
  return isCinema(segment) ? <CinemaDetailScreen {...props} /> : <DetailScreen {...props} />;
}
