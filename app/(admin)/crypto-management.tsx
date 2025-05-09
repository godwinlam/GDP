import CryptoOptionsManagement from "@/components/Admin/CryptoOptionsManagement";
import { Stack } from "expo-router";


export default function CryptoManagement() {
  return (
    <>
      <Stack.Screen
        options={{
          title: "Crypto Management",
          headerBackTitle: "Back",
          headerTitleAlign: "center",
          headerTintColor: "#fff",
          headerStyle: {
            backgroundColor: "#000",
          },
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 20,
            color: "#fff",
          },
        }}
      />
      <CryptoOptionsManagement />
    </>
  );
}
