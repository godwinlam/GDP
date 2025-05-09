import AdminInvestmentManagement from "@/components/Admin/AdminInvestmentManagement";
import { Stack } from "expo-router";

export default function InvestmentManagement() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <AdminInvestmentManagement />
    </>
  );
}
