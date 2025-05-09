import { Stack } from "expo-router";

export default function RelationshipLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="group-a"
        options={{
          title: "Group A",
          headerTitleAlign: "center",
          headerTintColor: "#fff",
          headerStyle: {
            backgroundColor: "#000",
          },
        }}
      />
      <Stack.Screen
        name="group-b"
        options={{
          title: "Group B",
          headerTitleAlign: "center",
          headerTintColor: "#fff",
          headerStyle: {
            backgroundColor: "#000",
          },
        }}
      />
    </Stack>
  );
}
