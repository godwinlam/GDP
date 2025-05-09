import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";
import FiveHundredRewardScreen from "@/components/Reward/500RewardScreen";

export default function Reward150Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <FiveHundredRewardScreen user={user} />;
}
