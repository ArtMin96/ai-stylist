// Route `/` → home feature. Routes stay thin: expo-router bundles every file under src/app, so
// screens, hooks and their tests/ live in src/features (features/README.md).
export { HomeScreen as default } from '@/features/home/home-screen';
