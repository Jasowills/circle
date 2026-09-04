import { registerRootComponent } from 'expo';
import App from './App';

// Explicit entry point so the dev server and Expo Go always resolve the
// same root component, regardless of Metro cache or project layout.
registerRootComponent(App);
