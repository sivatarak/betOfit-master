import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import SplashScreen from './SplashScreen';
import MainApp from './MainApp'; // Your main app component

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : (
        <MainApp />
      )}
    </>
  );
}
