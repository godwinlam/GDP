import OTCListingsScreen from "@/components/Investment/OTCListingsScreen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { User } from "@/types/user";

export default function OTCScreen() {
  const [user, setUser] = useState<User | null>(null);

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

  return <OTCListingsScreen />;
}
