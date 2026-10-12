// F1: SATU pustaka ikon = lucide-react. File ini shim kompatibilitas
// (nama + API lama: size/color/strokeWidth) agar pemakai lama tetap jalan
// selama migrasi bertahap. Menu baru WAJIB memakai lucide langsung.
import {
  LayoutGrid, Users, User, School, Calendar, ClipboardList, Check,
  BarChart3, BookOpen, MessageSquare, Bell, Settings, Lock, Search,
  MessageCircle, Upload, Camera, Star, MapPin, Activity, LogOut, Globe,
  type LucideIcon,
} from "lucide-react";

type P = { size?: number; color?: string; strokeWidth?: number; className?: string };

function wrap(Icon: LucideIcon) {
  const C = ({ size = 20, color, strokeWidth, className }: P) => (
    <Icon width={size} height={size} color={color} strokeWidth={strokeWidth} className={className} aria-hidden="true" />
  );
  return C;
}

export const IconGrid = wrap(LayoutGrid);
export const IconUsers = wrap(Users);
export const IconUser = wrap(User);
export const IconSchool = wrap(School);
export const IconCalendar = wrap(Calendar);
export const IconClipboard = wrap(ClipboardList);
export const IconCheck = wrap(Check);
export const IconBarChart = wrap(BarChart3);
export const IconBook = wrap(BookOpen);
export const IconMessage = wrap(MessageSquare);
export const IconBell = wrap(Bell);
export const IconSettings = wrap(Settings);
export const IconLock = wrap(Lock);
export const IconSearch = wrap(Search);
export const IconWhatsapp = wrap(MessageCircle);
export const IconUpload = wrap(Upload);
export const IconCamera = wrap(Camera);
export const IconStar = wrap(Star);
export const IconMapPin = wrap(MapPin);
export const IconActivity = wrap(Activity);
export const IconLogout = wrap(LogOut);
export const IconGlobe = wrap(Globe);
