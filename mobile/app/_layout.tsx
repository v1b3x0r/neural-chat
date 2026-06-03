import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { DrawerContent } from '@/components/drawer-content';

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Drawer
            drawerContent={(props) => <DrawerContent {...props} />}
            screenOptions={{ headerTitleAlign: 'center', drawerType: 'front' }}
          >
            <Drawer.Screen name="index" options={{ title: 'neural', headerShown: false }} />
            <Drawer.Screen name="models" options={{ title: 'Models' }} />
            <Drawer.Screen name="new-persona" options={{ title: 'สร้างเพื่อน' }} />
            <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
          </Drawer>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
