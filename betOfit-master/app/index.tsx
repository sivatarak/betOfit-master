import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasWeight, setHasWeight] = useState(false);

  useEffect(() => {
    const check = async () => {
      const weight = await AsyncStorage.getItem("BF_WEIGHT_KG");
      setHasWeight(!!weight && Number(weight) > 0);
      setReady(true);
    };
    check();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return hasWeight ? (
    
    <Redirect href="/(app)/home" />
  ) : (
    <Redirect href="/(auth)/splash" />
  );
}

