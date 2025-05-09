import OneFiftyRewardScreen from "@/components/Reward/150RewardScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function Reward150Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <OneFiftyRewardScreen user={user} />;
}
