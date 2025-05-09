import OneThirtyRewardScreen from "@/components/Reward/130RewardScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function Reward130Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <OneThirtyRewardScreen user={user} />;
}
