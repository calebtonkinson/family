"use client";

import {
  Home,
  DollarSign,
  Heart,
  Car,
  Briefcase,
  GraduationCap,
  Plane,
  ShoppingCart,
  Utensils,
  Dumbbell,
  Music,
  Camera,
  Book,
  Gamepad2,
  Dog,
  Baby,
  Users,
  Calendar,
  Star,
  Gift,
  Wrench,
  Laptop,
  Phone,
  Mail,
  Settings,
  Palette,
  Leaf,
  Sun,
  Moon,
  Cloud,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Map of common icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  home: Home,
  "dollar-sign": DollarSign,
  dollar: DollarSign,
  heart: Heart,
  car: Car,
  briefcase: Briefcase,
  work: Briefcase,
  graduation: GraduationCap,
  "graduation-cap": GraduationCap,
  education: GraduationCap,
  plane: Plane,
  travel: Plane,
  "shopping-cart": ShoppingCart,
  shopping: ShoppingCart,
  utensils: Utensils,
  food: Utensils,
  dumbbell: Dumbbell,
  fitness: Dumbbell,
  gym: Dumbbell,
  music: Music,
  camera: Camera,
  photo: Camera,
  book: Book,
  reading: Book,
  gamepad: Gamepad2,
  gaming: Gamepad2,
  dog: Dog,
  pet: Dog,
  baby: Baby,
  child: Baby,
  users: Users,
  family: Users,
  calendar: Calendar,
  star: Star,
  gift: Gift,
  wrench: Wrench,
  maintenance: Wrench,
  tools: Wrench,
  laptop: Laptop,
  computer: Laptop,
  tech: Laptop,
  phone: Phone,
  mail: Mail,
  email: Mail,
  settings: Settings,
  palette: Palette,
  art: Palette,
  leaf: Leaf,
  nature: Leaf,
  sun: Sun,
  moon: Moon,
  cloud: Cloud,
  umbrella: Umbrella,
};

// Check if a string is an emoji
function isEmoji(str: string): boolean {
  if (!str) return false;
  // Emoji regex pattern - covers most common emojis
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]+$/u;
  return emojiRegex.test(str.trim());
}

interface ThemeIconProps {
  icon?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ThemeIcon({ icon, name, size = "md", className }: ThemeIconProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-5 w-5",
    lg: "h-7 w-7",
  };

  // If icon is provided
  if (icon) {
    // Check if it's an emoji
    if (isEmoji(icon)) {
      return <span className={cn(sizeClasses[size], className)}>{icon}</span>;
    }

    // Check if it's a Lucide icon name
    const normalizedIconName = icon.toLowerCase().trim();
    const IconComponent = iconMap[normalizedIconName];
    
    if (IconComponent) {
      return <IconComponent className={cn(iconSizes[size], "text-white", className)} />;
    }
  }

  // Fallback to first letter of name
  return (
    <span className={cn(sizeClasses[size], className)}>
      {name?.[0]?.toUpperCase() || "T"}
    </span>
  );
}
