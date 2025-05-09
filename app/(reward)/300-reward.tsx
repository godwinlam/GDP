import ThreeHundredRewardScreen from "@/components/Reward/300RewardScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function Reward300Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <ThreeHundredRewardScreen user={user} />;
}
