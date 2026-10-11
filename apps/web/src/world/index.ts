// Public entry of the 3D world. 3D components are lazy so three.js stays out of the first load.
// 2D twins (SVG) are used in 2D mode, without WebGL2, and as the accessible path.
import { lazy } from 'react';

export type * from './contracts';
export { useRenderMode, type QualityTier, type RenderMode } from './quality';

export const CityScene = lazy(() => import('./city/CityScene'));
export const MissionScene = lazy(() => import('./scenes/MissionScene'));
export const GuardianFigure = lazy(() => import('./guardians/GuardianFigure'));

export { CityMap2D } from './flat/CityMap2D';
export { MissionScene2D } from './flat/MissionScene2D';
export { GuardianIcon } from './flat/GuardianIcon';
