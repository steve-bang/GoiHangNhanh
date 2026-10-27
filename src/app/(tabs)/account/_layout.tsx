import { Stack } from 'expo-router';

/** Stack riêng của tab: đi sâu trong tab vẫn giữ thanh tab; màn dùng header riêng (Screen). */
export default function TabStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
