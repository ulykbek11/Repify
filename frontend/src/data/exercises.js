import {
  Activity, ArrowDownToLine, ArrowUpFromLine, ArrowUpToLine, BicepsFlexed, ChevronsDown, Dumbbell,
  Equal, Footprints, GripHorizontal, Minus, MoveDown, TrendingUp, Weight,
} from 'lucide-react-native';

// Keep in sync with backend/app/services/exercises.py (a test checks the ids against the strings).
export const EXERCISE_GROUPS = [
  { id: 'legs', exercises: ['squat', 'lunge', 'hip_thrust'] },
  { id: 'hinge', exercises: ['deadlift', 'romanian_deadlift'] },
  { id: 'push', exercises: ['bench_press', 'overhead_press', 'push_up', 'dip'] },
  { id: 'pull', exercises: ['pull_up', 'row', 'lat_pulldown', 'bicep_curl'] },
  { id: 'core', exercises: ['plank'] },
];

export const EXERCISE_IDS = EXERCISE_GROUPS.flatMap((g) => g.exercises);

export const EXERCISE_ICONS = {
  squat: ChevronsDown,
  lunge: Footprints,
  hip_thrust: ArrowUpFromLine,
  deadlift: TrendingUp,
  romanian_deadlift: ArrowDownToLine,
  bench_press: Dumbbell,
  overhead_press: ArrowUpToLine,
  push_up: Activity,
  dip: Equal,
  pull_up: GripHorizontal,
  row: Weight,
  lat_pulldown: MoveDown,
  bicep_curl: BicepsFlexed,
  plank: Minus,
};

// Plank is a timed hold, every other exercise counts repetitions.
export const isHold = (exercise) => exercise === 'plank';
