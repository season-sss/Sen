import { BarChart3, Blocks, Brain, Briefcase, Building2, CircleHelp, Clock, CloudSun, Cpu, Gamepad2, Hand, Hash, Headphones, HeartPulse, Home, Keyboard, Landmark, Languages, Leaf, MapPin, Plane, Puzzle, School, Shapes, Shirt, ShoppingBag, Skull, Smile, Sparkles, Sun, Swords, Trees, Trophy, Users, UtensilsCrossed, Wand2, Zap, Circle, type LucideProps } from 'lucide-react';

/** Icons referenced by name from data (topics, games). Add new names here when data needs them. */
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  BarChart3,
  Blocks,
  Brain,
  Briefcase,
  Building2,
  CircleHelp,
  Clock,
  CloudSun,
  Cpu,
  Gamepad2,
  Hand,
  Hash,
  Headphones,
  HeartPulse,
  Home,
  Keyboard,
  Landmark,
  Languages,
  Leaf,
  MapPin,
  Plane,
  Puzzle,
  School,
  Shapes,
  Shirt,
  ShoppingBag,
  Skull,
  Smile,
  Sparkles,
  Sun,
  Swords,
  Trees,
  Trophy,
  Users,
  UtensilsCrossed,
  Wand2,
  Zap,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name] ?? Circle;
  return <C aria-hidden {...props} />;
}
