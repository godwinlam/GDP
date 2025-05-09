import AdminRewardManagement from "@/components/Admin/AdminRewardManagement";
import { Stack } from "expo-router";

export default function RewardManagement() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <AdminRewardManagement />
    </>
  );
}
