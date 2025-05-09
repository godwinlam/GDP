import GroupBScreen from "@/components/User/GroupBScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function GroupB() {
  const params = useLocalSearchParams();
  const children = JSON.parse(params.children as string) as User[];
  const currentUser = JSON.parse(params.currentUser as string) as User;

  return <GroupBScreen userChildren={children} currentUser={currentUser} />;
}
