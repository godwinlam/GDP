import GroupAScreen from "@/components/User/GroupAScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";

export default function GroupA() {
  const params = useLocalSearchParams();
  const children = JSON.parse(params.children as string) as User[];
  const currentUser = JSON.parse(params.currentUser as string) as User;

  return <GroupAScreen userChildren={children} currentUser={currentUser} />;
}
