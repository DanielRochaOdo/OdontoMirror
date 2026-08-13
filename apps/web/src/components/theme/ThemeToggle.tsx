import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../stores/app-store';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
