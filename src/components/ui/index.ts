/**
 * UI Component Library
 * 
 * Shared components following the IESA Vibrant Academic design system.
 * Import components from this file for consistent styling across the app.
 * 
 * @example
 * import { Button, Card, Badge, Modal } from '@/components/ui';
 */

// Breadcrumb Navigation
export {
  Breadcrumb,
  type BreadcrumbItem,
} from './Breadcrumb';

// Buttons
export { 
  Button, 
  IconButton,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
  type IconButtonProps,
} from './Button';

// Form Inputs
export { 
  Input, 
  TextArea, 
  Select,
  type InputProps,
  type TextAreaProps,
  type SelectProps,
} from './Input';

// Cards
export { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter,
  StatCard,
  type CardProps,
  type StatCardProps,
} from './Card';

// Badges
export { 
  Badge,
  StatusBadge,
  PriorityBadge,
  LevelBadge,
  CountBadge,
  type BadgeProps,
  type StatusBadgeProps,
  type PriorityBadgeProps,
  type LevelBadgeProps,
  type CountBadgeProps,
  type BadgeVariant,
  type BadgeSize,
  type Priority,
} from './Badge';

// Modals
export { 
  Modal, 
  ConfirmModal,
  type ModalProps,
  type ConfirmModalProps,
} from './Modal';

// Toast Notifications
export { 
  ToastProvider, 
  useToast,
  type Toast,
  type ToastType,
} from './Toast';

// Skeleton Loading States
export { 
  Skeleton,
  SkeletonText,
  SkeletonHeading,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonList,
  SkeletonPage,
} from './Skeleton';

// Tables
export { 
  Table,
  TableSimple,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
  Pagination,
  PaginatedTable,
  type TableProps,
  type TableRowProps,
  type TableHeadProps,
  type TableCellProps,
  type PaginationProps,
  type PaginatedTableProps,
} from './Table';

// Empty States
export { 
  EmptyState,
  NoDataState,
  NoSearchResultsState,
  NoNotificationsState,
  NoEventsState,
  NoPaymentsState,
  ErrorState,
  ComingSoonState,
  type EmptyStateProps,
} from './EmptyState';
