import GDPScreen from "@/components/Investment/GDPScreen";
import { useLocalSearchParams } from "expo-router";
import { User } from "@/types/user";
import { auth, db } from "@/firebase";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ActivityIndicator, View } from "react-native";

export default function GDP() {
  const [user, setUser] = useState<User | null>(null);
  // const params = useLocalSearchParams();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const unsubscribe = onSnapshot(doc(db, "users", currentUser.uid), (doc) => {
      if (doc.exists()) {
        setUser({ ...doc.data(), uid: doc.id } as User);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <GDPScreen user={user} />;
}
