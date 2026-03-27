import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface StyledSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface StyledSelectProps {
  value: string;
  options: StyledSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  wrapperClassName?: string;
  buttonClassName?: string;
  panelClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  labelClassName?: string;
  iconClassName?: string;
  menuAlign?: 'left' | 'right';
}

const cx = (...classes: Array<string | undefined | false>) =>
  classes.filter(Boolean).join(' ');

const StyledSelect: React.FC<StyledSelectProps> = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  wrapperClassName,
  buttonClassName,
  panelClassName,
  optionClassName,
  selectedOptionClassName,
  labelClassName,
  iconClassName,
  menuAlign = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  );
  const isInteractive = !disabled && enabledOptions.length > 0;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const displayLabel =
    selectedOption?.label ||
    placeholder ||
    options[0]?.label ||
    'Žiadne možnosti';

  const findNextEnabledIndex = (start: number, direction: 1 | -1) => {
    if (!options.length) return -1;

    let current = start;
    for (let i = 0; i < options.length; i += 1) {
      current = (current + direction + options.length) % options.length;
      if (!options[current]?.disabled) return current;
    }

    return -1;
  };

  const handleSelect = (nextValue: string) => {
    if (nextValue !== value) onChange(nextValue);
    setIsOpen(false);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
      setHighlightedIndex(selectedIndex);
      return;
    }
    setHighlightedIndex(findNextEnabledIndex(-1, 1));
  }, [isOpen, options, value]);

  return (
    <div ref={containerRef} className={cx('relative', wrapperClassName)}>
      <button
        type="button"
        onClick={() => {
          if (!isInteractive) return;
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (!isInteractive) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              return;
            }
            setHighlightedIndex((prev) => findNextEnabledIndex(prev, 1));
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              return;
            }
            setHighlightedIndex((prev) => findNextEnabledIndex(prev, -1));
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              return;
            }
            const highlightedOption = options[highlightedIndex];
            if (highlightedOption && !highlightedOption.disabled) {
              handleSelect(highlightedOption.value);
            }
          }
        }}
        disabled={!isInteractive}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cx(
          'relative w-full text-left focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all',
          buttonClassName
        )}
      >
        <span className={cx('block truncate pr-10', labelClassName)}>{displayLabel}</span>
        <ChevronDown
          className={cx(
            'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-transform',
            isOpen ? 'rotate-180' : '',
            iconClassName
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={cx(
            'absolute z-50 mt-2 max-h-72 overflow-auto rounded-2xl border border-black/10 bg-white p-2 shadow-2xl',
            menuAlign === 'right' ? 'right-0 left-auto w-full' : 'left-0 w-full',
            panelClassName
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = highlightedIndex === index;
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  if (option.disabled) return;
                  handleSelect(option.value);
                }}
                disabled={option.disabled}
                className={cx(
                  'w-full px-4 py-3 rounded-xl text-left text-sm font-bold transition-all flex items-center justify-between gap-2',
                  !isSelected && 'text-black/70 hover:bg-black/5',
                  isHighlighted && !isSelected && 'bg-black/[0.04]',
                  isSelected && 'bg-black text-white',
                  option.disabled && 'opacity-40 cursor-not-allowed',
                  optionClassName,
                  isSelected && selectedOptionClassName
                )}
              >
                <span className="block truncate">{option.label}</span>
                {isSelected && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StyledSelect;
