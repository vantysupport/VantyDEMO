'use client'

import { Loader2, FileText, Users, Calendar, Frown, Search, Zap } from 'lucide-react';

// ==============================================================================
// LOADING STATE
// ==============================================================================

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ 
  message = 'Cargando...', 
  fullScreen = false,
  size = 'md'
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const containerClass = fullScreen
    ? "fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50"
    : "flex items-center justify-center p-8";

  return (
    <div className={containerClass}>
      <div className="text-center">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600 mx-auto`} />
        <p className="mt-3 text-sm text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

// ==============================================================================
// LOADING SKELETON
// ==============================================================================

export function LoadingSkeleton({ type = 'card' }: { type?: 'card' | 'list' | 'table' }) {
  if (type === 'card') {
    return (
      <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 animate-pulse">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="flex-1">
              <div className="h-3 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-2 bg-gray-200 rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ==============================================================================
// EMPTY STATE
// ==============================================================================

interface EmptyStateProps {
  icon?: 'file' | 'users' | 'calendar' | 'search' | 'zap' | 'frown';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export function EmptyState({ 
  icon = 'file', 
  title, 
  description, 
  action,
  compact = false 
}: EmptyStateProps) {
  const icons = {
    file: FileText,
    users: Users,
    calendar: Calendar,
    search: Search,
    zap: Zap,
    frown: Frown
  };

  const Icon = icons[icon];

  return (
    <div className={`
      flex flex-col items-center justify-center 
      ${compact ? 'py-8' : 'py-12'} 
      px-4 bg-gradient-to-b from-gray-50 to-white 
      rounded-2xl border-2 border-dashed border-gray-200
    `}>
      <div className={`
        ${compact ? 'w-12 h-12' : 'w-16 h-16'} 
        bg-gray-100 rounded-2xl flex items-center justify-center mb-4
      `}>
        <Icon className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-gray-300`} />
      </div>
      
      <h3 className={`
        text-gray-800 font-black 
        ${compact ? 'text-base' : 'text-lg'} 
        mb-2
      `}>
        {title}
      </h3>
      
      <p className={`
        ${compact ? 'text-xs' : 'text-sm'} 
        text-gray-500 text-center max-w-sm px-4 mb-4
      `}>
        {description}
      </p>
      
      {action && (
        <button
          onClick={action.onClick}
          className={`
            ${compact ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-base'} 
            bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
            font-bold transition-all shadow-lg hover:shadow-xl
            hover:-translate-y-0.5 active:translate-y-0
          `}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ==============================================================================
// ERROR STATE
// ==============================================================================

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
}

export function ErrorState({ 
  title = 'Algo salió mal',
  message = 'No pudimos cargar la información. Por favor intenta nuevamente.',
  retry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <Frown className="w-8 h-8 text-red-500" />
      </div>
      
      <h3 className="text-gray-800 font-black text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center max-w-sm mb-4">{message}</p>
      
      {retry && (
        <button
          onClick={retry}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

// ==============================================================================
// PROGRESS BAR
// ==============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ 
  value, 
  max = 100, 
  label,
  showPercentage = true,
  color = 'blue',
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min(100, (value / max) * 100);
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  return (
    <div>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-bold text-gray-700">{label}</span>
          )}
          {showPercentage && (
            <span className="text-sm font-black text-gray-900">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`${sizeClasses[size]} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ==============================================================================
// BADGE
// ==============================================================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span className={`
      inline-flex items-center gap-1
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      font-bold rounded-full border-2
    `}>
      {children}
    </span>
  );
}

// ==============================================================================
// STAT CARD
// ==============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red';
}

export function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600'
  };

  return (
    <div className={`
      bg-gradient-to-br ${colorClasses[color]} 
      rounded-2xl p-6 text-white shadow-lg
      hover:shadow-xl transition-all
    `}>
      <div className="flex items-center justify-between mb-3">
        {icon && (
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            {icon}
          </div>
        )}
        
        {trend && (
          <div className={`
            flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
            ${trend.isPositive ? 'bg-white/20' : 'bg-black/20'}
          `}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      <p className="text-sm opacity-90 font-medium mb-1">{title}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}