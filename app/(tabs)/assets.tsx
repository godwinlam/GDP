import { Stack } from 'expo-router';
import Assets from '@/components/User/Assets';

export default function AssetsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Assets',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#333333',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Assets />
    </>
  );
}


