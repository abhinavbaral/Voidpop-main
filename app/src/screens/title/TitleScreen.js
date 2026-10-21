// The "Detail" route: anime and manga use the tracker page (DetailScreen),
// movies and series use the verdict page (CinemaDetailScreen).
import { isCinema } from "@voidpop/shared/api/tmdb";
import DetailScreen from "./DetailScreen.js";
import CinemaDetailScreen from "../cinema/CinemaDetailScreen.js";

export default function TitleScreen(props) {
  return isCinema(props.route?.params?.segment) ? <CinemaDetailScreen {...props} /> : <DetailScreen {...props} />;
}
