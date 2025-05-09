import AdminGDPManagementScreen from "@/components/Admin/AdminGDPManagementScreen";
import { Stack } from "expo-router";

export default function GDPManagement() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <AdminGDPManagementScreen />
    </>
  );
}
