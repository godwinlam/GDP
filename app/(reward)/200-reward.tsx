import TwoHundredRewardScreen from "@/components/Reward/200RewardScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function Reward200Screen() {
  const params = useLocalSearchParams();
  const user = JSON.parse(params.user as string) as User;

  return <TwoHundredRewardScreen user={user} />;
}
