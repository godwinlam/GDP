import { StyleSheet } from "react-native";
import { View } from "@/components/Themed";
import UserProfileScreen from "@/components/User/UserProfile";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <UserProfileScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
