import { useWindowDimensions } from 'react-native';

/**
 * Standard responsive breakpoints hook:
 * sm: < 700px
 * md: 700px - 1099px
 * lg: 1100px - 1499px
 * xl: >= 1500px
 */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();

  const isSm = width < 700;
  const isMd = width >= 700 && width < 1100;
  const isLg = width >= 1100 && width < 1500;
  const isXl = width >= 1500;
  const isDesktop = width >= 768;
  const isNarrow = width < 900;
  const isWide = width >= 1100;

  return {
    width,
    height,
    isSm,
    isMd,
    isLg,
    isXl,
    isDesktop,
    isNarrow,
    isWide,
  };
}
