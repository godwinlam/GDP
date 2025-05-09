import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="user-management" />
      <Stack.Screen name="gdp-management" />
      <Stack.Screen name="investment-management" />
      <Stack.Screen name="reward-management" />
      <Stack.Screen name="withdrawal-management" />
      <Stack.Screen name="topup-management" />
      <Stack.Screen name="crypto-management" />
      <Stack.Screen name="payment-reject-control"/>
      <Stack.Screen name="carousel-management"/>
    </Stack>
  );
}
