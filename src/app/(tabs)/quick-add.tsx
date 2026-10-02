import { QuickAddScreen } from "@/modules/quick-add";
import { useAuthSession } from "@/modules/auth";

/** Quick Add route: hands the signed-in user to the swipe deck; keyed by user so another account never inherits the deck's state. */
export default function QuickAddRoute() {
  const { session } = useAuthSession();
  // The route guard removes this screen on sign-out; until it does there is nothing to show.
  if (!session) return null;
  return <QuickAddScreen key={session.user.id} userId={session.user.id} />;
}
