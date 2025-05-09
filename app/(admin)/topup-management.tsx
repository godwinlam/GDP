import { View } from '@/components/Themed';
import AdminTopUpManagement from '@/components/Admin/AdminTopUpManagement';
import { Stack } from 'expo-router';

export default function TopUpManagementScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{

          headerShown: false
        }}
      />
      <AdminTopUpManagement />
    </View>
  );
}
