import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";
import OneThousandRewardScreen from "@/components/Reward/1000RewardScreen";

export default function Reward1000Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <OneThousandRewardScreen user={user} />;
}
