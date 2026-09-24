import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const onPress = props.onPress as PressableProps['onPress'];

  return (
    <Pressable
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={props.accessibilityState}
      onLongPress={props.onLongPress}
      onPress={onPress}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      style={props.style}
      testID={props.testID}
    >
      {props.children}
    </Pressable>
  );
}
