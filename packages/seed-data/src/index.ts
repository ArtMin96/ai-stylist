// Synthetic factories. Deterministic (seeded faker), never derived from real user data.
export { DEFAULT_REF_DATE, DEFAULT_SEED, type SyntheticRandom, syntheticRandom } from './random.js';
export {
  DEMO_EVENT_TYPE,
  type DemoEvent,
  type DemoEventOverrides,
  demoEvent,
} from './demo-event.js';
