import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function CloseIcon({ color, size = 24 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}><Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}

export function FilterIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}><Path d="M4 7h6m4 0h6M4 17h10m4 0h2M10 4v6m4 4v6" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>;
}

type IconProps = { color: string; size?: number };

export function PlayIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M7 4.5 L19.5 12 L7 19.5 Z" fill={color} />
    </Svg>
  );
}

export function StopIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
    </Svg>
  );
}

export function ChevronIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M9 5 L16 12 L9 19" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M5 12.5 L10 17 L19 7" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Yuvarlatılmış beş köşeli yıldız (UNESCO rozeti). */
export function StarIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 3.5 L14.6 8.9 L20.5 9.7 L16.2 13.8 L17.3 19.7 L12 16.9 L6.7 19.7 L7.8 13.8 L3.5 9.7 L9.4 8.9 Z" fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function ExternalIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M14 4 H20 V10 M20 4 L11 13 M18 14 V19 A1 1 0 0 1 17 20 H5 A1 1 0 0 1 4 19 V7 A1 1 0 0 1 5 6 H10" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function InfoIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Rect x="11" y="10.5" width="2" height="6.5" rx="1" fill={color} />
      <Circle cx="12" cy="7.6" r="1.25" fill={color} />
    </Svg>
  );
}

/** Dönüş oku: düz, hafif/sert sağ-sol, geri; varışta hedef işareti. */
export function TurnIcon({ turn, arrived, color, size = 28 }: IconProps & { turn: string; arrived?: boolean }) {
  if (arrived) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2.4} fill="none" />
        <Circle cx="12" cy="12" r="4" fill={color} />
      </Svg>
    );
  }
  const rotate = { straight: 0, slight_right: 40, right: 90, slight_left: -40, left: -90, back: 180 }[turn] ?? 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Path d="M12 20 V5 M6 10.5 L12 4.5 L18 10.5" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={2.4} fill="none" />
      <Path d="M15.5 15.5 L20.5 20.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function MapIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M9 4 L3 6.5 V20 L9 17.5 L15 20 L21 17.5 V4 L15 6.5 Z M9 4 V17.5 M15 6.5 V20" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function ListIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M8 6 H20 M8 12 H20 M8 18 H20" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="4" cy="6" r="1.4" fill={color} />
      <Circle cx="4" cy="12" r="1.4" fill={color} />
      <Circle cx="4" cy="18" r="1.4" fill={color} />
    </Svg>
  );
}

export function PinIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z" stroke={color} strokeWidth={2} fill="none" />
      <Circle cx="12" cy="9.5" r="2.4" fill={color} />
    </Svg>
  );
}

export function SoundIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z" fill={color} />
      <Path d="M16.5 8.5 A5 5 0 0 1 16.5 15.5 M19 6 A8.5 8.5 0 0 1 19 18" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Sekme çubuğu simgeleri: seçiliyken dolu, değilken çizgi. */
type TabIconProps = IconProps & { filled?: boolean };

export function CompassIcon({ color, size = 24, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M15.5 8.5 L13.4 13.4 L8.5 15.5 L10.6 10.6 Z" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function RouteIcon({ color, size = 24, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M6 17.5 V9 A3.5 3.5 0 0 1 13 9 V15 A3.5 3.5 0 0 0 20 15 V6.5" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx="6" cy="19" r="2.3" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} />
      <Circle cx="20" cy="5" r="2.3" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function ChatIcon({ color, size = 24, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M5 4.5 H19 A2 2 0 0 1 21 6.5 V15 A2 2 0 0 1 19 17 H11 L6.5 20.5 V17 H5 A2 2 0 0 1 3 15 V6.5 A2 2 0 0 1 5 4.5 Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PersonIcon({ color, size = 24, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx="12" cy="8" r="3.8" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} />
      <Path d="M4.5 20.5 A7.5 7.5 0 0 1 19.5 20.5 Z" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
