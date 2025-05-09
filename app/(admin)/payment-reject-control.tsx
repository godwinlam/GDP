import PaymentRejectControl from "@/components/Admin/PaymentRejectControl";
import { Stack } from "expo-router";

export default function PaymentRejectManagement() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <PaymentRejectControl />
    </>
  );
}