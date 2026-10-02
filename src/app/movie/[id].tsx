import { useLocalSearchParams } from "expo-router";
import { MovieDetailsScreen } from "@/modules/movies";

/** Movie details route: reads the `id` param and hands it to the movies module. */
export default function MovieRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MovieDetailsScreen idParam={id} />;
}
