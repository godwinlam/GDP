import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
} from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { User, GDPPurchase } from "@/types/user";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRoute, RouteProp } from "@react-navigation/native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { router } from "expo-router";
import OneThirtyGDPRewardProgress from "@/components/RewardProgress/130GDPRewardProgress";
import OneFiftyGDPRewardProgress from "@/components/RewardProgress/150GDPRewardProgress";
import TwoHundredGDPRewardProgress from "@/components/RewardProgress/200GDPRewardProgress";
import ThreeHundredGDPRewardProgress from "@/components/RewardProgress/300GDPRewardProgress";
import FiveHundredGDPRewardProgress from "@/components/RewardProgress/500GDPRewardProgress";
import OneThousandGDPRewardProgress from "@/components/RewardProgress/1000GDPRewardProgress";
import { useLanguage } from "@/hooks/useLanguage";

type RootStackParamList = {
  Main: undefined;
  Relationship: { currentUser: User };
  GroupA: { children: User[]; currentUser: User };
  GroupB: { children: User[]; currentUser: User };
  "130Reward": { user: User };
  "150Reward": { user: User };
  "200Reward": { user: User };
  "300Reward": { user: User };
  "500Reward": { user: User };
  "1000Reward": { user: User };
  TransactionHistory: { user: User };
};

type RelationshipScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Relationship"
>;
type RelationshipScreenRouteProp = RouteProp<
  RootStackParamList,
  "Relationship"
>;

interface RelationshipScreenProps {
  currentUser: User;
}

export default function RelationshipScreen({
  currentUser,
}: RelationshipScreenProps) {
  const navigation = useNavigation<RelationshipScreenNavigationProp>();
  const [user, setUser] = useState<User>(currentUser);
  const [children, setChildren] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalGroupA, setTotalGroupA] = useState(0);
  const [totalGroupB, setTotalGroupB] = useState(0);
  const [hasGDPPurchase, setHasGDPPurchase] = useState(false);
  const [qualifyingChildren, setQualifyingChildren] = useState<number>(0);
  const [qualifyingGrandchildren, setQualifyingGrandchildren] =
    useState<number>(0);
  const [qualifyingGreatGrandchildren, setQualifyingGreatGrandchildren] =
    useState<number>(0);
  const [
    qualifyingGreatGreatGrandchildren,
    setQualifyingGreatGreatGrandchildren,
  ] = useState<number>(0);
  const [
    qualifyingGreatGreatGreatGrandchildren,
    setQualifyingGreatGreatGreatGrandchildren,
  ] = useState<number>(0);
  const [
    qualifyingGreatGreatGreatGreatGrandchildren,
    setQualifyingGreatGreatGreatGreatGrandchildren,
  ] = useState<number>(0);
  const [parentGDPPrice, setParentGDPPrice] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [rewardClaimed130, setRewardClaimed130] = useState(false);
  const [rewardClaimed150, setRewardClaimed150] = useState(false);
  const [rewardClaimed200, setRewardClaimed200] = useState(false);
  const [rewardClaimed300, setRewardClaimed300] = useState(false);
  const [rewardClaimed500, setRewardClaimed500] = useState(false);
  const [rewardClaimed1000, setRewardClaimed1000] = useState(false);
  const getUserGDPPurchase = async (
    userId: string
  ): Promise<GDPPurchase | null> => {
    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const gdpPurchaseData = querySnapshot.docs[0].data();
      return {
        id: querySnapshot.docs[0].id,
        ...gdpPurchaseData,
      } as GDPPurchase;
    }
    return null;
  }; 
  
 const { t } = useLanguage();

  useEffect(() => {
    setLoading(true);

    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setUser({ ...docSnapshot.data(), uid: docSnapshot.id } as User);
      }
    });

    // Check GDP purchase and reward status
    const checkGDPStatus = async () => {
      try {
        const gdpPurchase = await getUserGDPPurchase(currentUser.uid);
        if (gdpPurchase) {
          setHasGDPPurchase(true);
          setParentGDPPrice(gdpPurchase.purchasePrice);
          setRewardClaimed130(Boolean(gdpPurchase.rewardClaimed130));
          setRewardClaimed150(Boolean(gdpPurchase.rewardClaimed150));
          setRewardClaimed200(Boolean(gdpPurchase.rewardClaimed200));
          setRewardClaimed300(Boolean(gdpPurchase.rewardClaimed300));
          setRewardClaimed500(Boolean(gdpPurchase.rewardClaimed500));
          setRewardClaimed1000(Boolean(gdpPurchase.rewardClaimed1000));
          setRewardClaimed(
            Boolean(gdpPurchase.rewardClaimed130) ||
              Boolean(gdpPurchase.rewardClaimed150) ||
              Boolean(gdpPurchase.rewardClaimed200) ||
              Boolean(gdpPurchase.rewardClaimed300) ||
              Boolean(gdpPurchase.rewardClaimed500) ||
              Boolean(gdpPurchase.rewardClaimed1000)
          );
        } else {
          setHasGDPPurchase(false);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error checking GDP status:", error);
        setLoading(false);
      }
    };

    checkGDPStatus();

    return () => unsubscribe();
  }, [currentUser.uid]);

  const checkQualifyingChildren = async () => {
    try {
      const parentGDPPurchase = await getUserGDPPurchase(currentUser.uid);
      if (!parentGDPPurchase) return;

      setParentGDPPrice(parentGDPPurchase.purchasePrice);

      let matchingChildren = 0;
      let matchingGrandchildren = 0;
      let matchingGreatGrandchildren = 0;
      let matchingGreatGreatGrandchildren = 0;
      let matchingGreatGreatGreatGrandchildren = 0;
      let matchingGreatGreatGreatGreatGrandchildren = 0;

      // Get all direct children
      const usersRef = collection(db, "users");
      const childrenQuery = query(
        usersRef,
        where("parentId", "==", currentUser.uid)
      );
      const childrenSnapshot = await getDocs(childrenQuery);

      // Check each child and their descendants
      for (const childDoc of childrenSnapshot.docs) {
        const childGDPPurchase = await getUserGDPPurchase(childDoc.id);

        if (
          childGDPPurchase &&
          childGDPPurchase.purchasePrice === parentGDPPurchase.purchasePrice
        ) {
          matchingChildren++;

          // Get grandchildren for this child
          const grandchildrenQuery = query(
            usersRef,
            where("parentId", "==", childDoc.id)
          );
          const grandchildrenSnapshot = await getDocs(grandchildrenQuery);

          // Check each grandchild and their children (great-grandchildren)
          for (const grandchildDoc of grandchildrenSnapshot.docs) {
            const grandchildGDPPurchase = await getUserGDPPurchase(
              grandchildDoc.id
            );

            if (
              grandchildGDPPurchase &&
              grandchildGDPPurchase.purchasePrice ===
                parentGDPPurchase.purchasePrice
            ) {
              matchingGrandchildren++;

              // Get great-grandchildren for this grandchild
              const greatGrandchildrenQuery = query(
                usersRef,
                where("parentId", "==", grandchildDoc.id)
              );
              const greatGrandchildrenSnapshot = await getDocs(
                greatGrandchildrenQuery
              );

              // Check each great-grandchild's GDP purchase
              for (const greatGrandchildDoc of greatGrandchildrenSnapshot.docs) {
                const greatGrandchildGDPPurchase = await getUserGDPPurchase(
                  greatGrandchildDoc.id
                );

                if (
                  greatGrandchildGDPPurchase &&
                  greatGrandchildGDPPurchase.purchasePrice ===
                    parentGDPPurchase.purchasePrice
                ) {
                  matchingGreatGrandchildren++;

                  // Get great-great-grandchildren for this great-grandchild
                  const greatGreatGrandchildrenQuery = query(
                    usersRef,
                    where("parentId", "==", greatGrandchildDoc.id)
                  );
                  const greatGreatGrandchildrenSnapshot = await getDocs(
                    greatGreatGrandchildrenQuery
                  );

                  // Check each great-great-grandchild's GDP purchase
                  for (const greatGreatGrandchildDoc of greatGreatGrandchildrenSnapshot.docs) {
                    const greatGreatGrandchildGDPPurchase =
                      await getUserGDPPurchase(greatGreatGrandchildDoc.id);

                    if (
                      greatGreatGrandchildGDPPurchase &&
                      greatGreatGrandchildGDPPurchase.purchasePrice ===
                        parentGDPPurchase.purchasePrice
                    ) {
                      matchingGreatGreatGrandchildren++;

                      // Get great-great-great-grandchildren
                      const greatGreatGreatGrandchildrenQuery = query(
                        usersRef,
                        where("parentId", "==", greatGreatGrandchildDoc.id)
                      );
                      const greatGreatGreatGrandchildrenSnapshot =
                        await getDocs(greatGreatGreatGrandchildrenQuery);

                      // Check each great-great-great-grandchild's GDP purchase
                      for (const greatGreatGreatGrandchildDoc of greatGreatGreatGrandchildrenSnapshot.docs) {
                        const greatGreatGreatGrandchildGDPPurchase =
                          await getUserGDPPurchase(
                            greatGreatGreatGrandchildDoc.id
                          );

                        if (
                          greatGreatGreatGrandchildGDPPurchase &&
                          greatGreatGreatGrandchildGDPPurchase.purchasePrice ===
                            parentGDPPurchase.purchasePrice
                        ) {
                          matchingGreatGreatGreatGrandchildren++;

                          // Get great-great-great-great-grandchildren
                          const greatGreatGreatGreatGrandchildrenQuery = query(
                            usersRef,
                            where(
                              "parentId",
                              "==",
                              greatGreatGreatGrandchildDoc.id
                            )
                          );
                          const greatGreatGreatGreatGrandchildrenSnapshot =
                            await getDocs(
                              greatGreatGreatGreatGrandchildrenQuery
                            );

                          // Check each great-great-great-great-grandchild's GDP purchase
                          for (const greatGreatGreatGreatGrandchildDoc of greatGreatGreatGreatGrandchildrenSnapshot.docs) {
                            const greatGreatGreatGreatGrandchildGDPPurchase =
                              await getUserGDPPurchase(
                                greatGreatGreatGreatGrandchildDoc.id
                              );

                            if (
                              greatGreatGreatGreatGrandchildGDPPurchase &&
                              greatGreatGreatGreatGrandchildGDPPurchase.purchasePrice ===
                                parentGDPPurchase.purchasePrice
                            ) {
                              matchingGreatGreatGreatGreatGrandchildren++;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      setQualifyingChildren(matchingChildren);
      setQualifyingGrandchildren(matchingGrandchildren);
      setQualifyingGreatGrandchildren(matchingGreatGrandchildren);
      setQualifyingGreatGreatGrandchildren(matchingGreatGreatGrandchildren);
      setQualifyingGreatGreatGreatGrandchildren(
        matchingGreatGreatGreatGrandchildren
      );
      setQualifyingGreatGreatGreatGreatGrandchildren(
        matchingGreatGreatGreatGreatGrandchildren
      );
    } catch (error) {
      console.error("Error checking qualifying children:", error);
    }
  };

  // Update the useEffect to use the function
  useEffect(() => {
    // Set up listeners for children and GDP data
    const usersRef = collection(db, "users");
    const childrenQuery = query(
      usersRef,
      where("parentId", "==", currentUser.uid)
    );

    const unsubscribeChildren = onSnapshot(childrenQuery, (querySnapshot) => {
      const validChildren: User[] = [];
      querySnapshot.forEach((doc) => {
        validChildren.push({ uid: doc.id, ...doc.data() } as User);
      });
      setChildren(validChildren);

      const groupACounts = validChildren.filter(
        (child) => child.group === "A"
      ).length;
      const groupBCounts = validChildren.filter(
        (child) => child.group === "B"
      ).length;
      setTotalGroupA(groupACounts);
      setTotalGroupB(groupBCounts);
    });

    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const gdpQuery = query(
      gdpPurchasesRef,
      where("userId", "==", currentUser.uid)
    );

    const unsubscribeGDP = onSnapshot(gdpQuery, async (querySnapshot) => {
      const hasGDP = !querySnapshot.empty;
      setHasGDPPurchase(hasGDP);

      if (hasGDP) {
        await checkQualifyingChildren();
      }
      setLoading(false);
    });

    // Cleanup function
    return () => {
      unsubscribeChildren();
      unsubscribeGDP();
    };
  }, [currentUser.uid]); // Remove children from dependencies

  const refreshData = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const parentGDPPurchase = await getUserGDPPurchase(currentUser.uid);
      if (parentGDPPurchase) {
        setParentGDPPrice(parentGDPPurchase.purchasePrice);
        setHasGDPPurchase(true);
        setRewardClaimed130(Boolean(parentGDPPurchase.rewardClaimed130));
        setRewardClaimed150(Boolean(parentGDPPurchase.rewardClaimed150));
        setRewardClaimed200(Boolean(parentGDPPurchase.rewardClaimed200));
        setRewardClaimed300(Boolean(parentGDPPurchase.rewardClaimed300));
        setRewardClaimed500(Boolean(parentGDPPurchase.rewardClaimed500));
        setRewardClaimed1000(Boolean(parentGDPPurchase.rewardClaimed1000));
        setRewardClaimed(
          Boolean(parentGDPPurchase.rewardClaimed130) ||
            Boolean(parentGDPPurchase.rewardClaimed150) ||
            Boolean(parentGDPPurchase.rewardClaimed200) ||
            Boolean(parentGDPPurchase.rewardClaimed300) ||
            Boolean(parentGDPPurchase.rewardClaimed500) ||
            Boolean(parentGDPPurchase.rewardClaimed1000)
        );
        await checkQualifyingChildren();
      } else {
        setHasGDPPurchase(false);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser.uid]);

  // Add useEffect to call refreshData on mount and focus
  useEffect(() => {
    refreshData();

    // Add navigation focus listener
    const unsubscribe = navigation.addListener("focus", () => {
      refreshData();
    });

    return unsubscribe;
  }, [navigation, refreshData]);

  useEffect(() => {
    if (!currentUser.uid) return;

    const gdpPurchasesRef = collection(db, "gdpPurchases");
    const q = query(gdpPurchasesRef, where("userId", "==", currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const gdpPurchase = snapshot.docs[0].data() as GDPPurchase;
        setHasGDPPurchase(true);
        setParentGDPPrice(gdpPurchase.purchasePrice);
        setRewardClaimed130(Boolean(gdpPurchase.rewardClaimed130));
        setRewardClaimed150(Boolean(gdpPurchase.rewardClaimed150));
        setRewardClaimed200(Boolean(gdpPurchase.rewardClaimed200));
        setRewardClaimed300(Boolean(gdpPurchase.rewardClaimed300));
        setRewardClaimed500(Boolean(gdpPurchase.rewardClaimed500));
        setRewardClaimed1000(Boolean(gdpPurchase.rewardClaimed1000));
        setRewardClaimed(
          Boolean(gdpPurchase.rewardClaimed130) ||
            Boolean(gdpPurchase.rewardClaimed150) ||
            Boolean(gdpPurchase.rewardClaimed200) ||
            Boolean(gdpPurchase.rewardClaimed300) ||
            Boolean(gdpPurchase.rewardClaimed500) ||
            Boolean(gdpPurchase.rewardClaimed1000)
        );
        await checkQualifyingChildren();
      } else {
        setHasGDPPurchase(false);
        setRewardClaimed(false);
        setRewardClaimed130(false);
        setRewardClaimed150(false);
        setRewardClaimed200(false);
        setRewardClaimed300(false);
        setRewardClaimed500(false);
        setRewardClaimed1000(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleGroupAPress = () => {
    router.push({
      pathname: "/(relationship)/group-a",
      params: {
        children: JSON.stringify(
          children.filter((child) => child.group === "A")
        ),
        currentUser: JSON.stringify(currentUser),
      },
    });
  };

  const handleGroupBPress = () => {
    router.push({
      pathname: "/(relationship)/group-b",
      params: {
        children: JSON.stringify(
          children.filter((child) => child.group === "B")
        ),
        currentUser: JSON.stringify(currentUser),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>{t.UserNotAuthenticated}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>{t.back}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshData} />
      }
    >
      <Text style={styles.title}>{t.Friends}</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.button} onPress={handleGroupAPress}>
          <Text style={styles.buttonText}>{t.group} A ({totalGroupA})</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleGroupBPress}>
          <Text style={styles.buttonText}>{t.group} B ({totalGroupB})</Text>
        </TouchableOpacity>
      </View>

      {hasGDPPurchase && (
        <>
          <OneThirtyGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed130={rewardClaimed130}
          />
          <OneFiftyGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            qualifyingGrandchildren={qualifyingGrandchildren}
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed150={rewardClaimed150}
          />
          <TwoHundredGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            qualifyingGrandchildren={qualifyingGrandchildren}
            qualifyingGreatGrandchildren={qualifyingGreatGrandchildren}
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed200={rewardClaimed200}
          />
          <ThreeHundredGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            qualifyingGrandchildren={qualifyingGrandchildren}
            qualifyingGreatGrandchildren={qualifyingGreatGrandchildren}
            qualifyingGreatGreatGrandchildren={
              qualifyingGreatGreatGrandchildren
            }
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed300={rewardClaimed300}
          />
          <FiveHundredGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            qualifyingGrandchildren={qualifyingGrandchildren}
            qualifyingGreatGrandchildren={qualifyingGreatGrandchildren}
            qualifyingGreatGreatGrandchildren={
              qualifyingGreatGreatGrandchildren
            }
            qualifyingGreatGreatGreatGrandchildren={
              qualifyingGreatGreatGreatGrandchildren
            }
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed500={rewardClaimed500}
          />
          <OneThousandGDPRewardProgress
            qualifyingChildren={qualifyingChildren}
            qualifyingGrandchildren={qualifyingGrandchildren}
            qualifyingGreatGrandchildren={qualifyingGreatGrandchildren}
            qualifyingGreatGreatGrandchildren={
              qualifyingGreatGreatGrandchildren
            }
            qualifyingGreatGreatGreatGrandchildren={
              qualifyingGreatGreatGreatGrandchildren
            }
            qualifyingGreatGreatGreatGreatGrandchildren={
              qualifyingGreatGreatGreatGreatGrandchildren
            }
            parentGDPPrice={parentGDPPrice}
            user={user}
            rewardClaimed={rewardClaimed}
            rewardClaimed1000={rewardClaimed1000}
          />
        </>
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>{t.back}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const shadowStyle = Platform.select({
  ios: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },
  android: {
    elevation: 3,
  },
  default: {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },
});

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    ...shadowStyle,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  backButton: {
    marginTop: 20,
    backgroundColor: "#757575",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    ...Platform.select({
      ios: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
