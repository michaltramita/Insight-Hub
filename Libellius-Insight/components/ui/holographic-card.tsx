import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HolographicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  disabled?: boolean;
}

const HolographicCard = React.forwardRef<HTMLDivElement, HolographicCardProps>(
  ({ children, className, disabled = false, ...props }, forwardedRef) => {
    const localRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const boundsRef = useRef<DOMRect | null>(null);
    const targetRotateRef = useRef({ x: 0, y: 0 });
    const currentRotateRef = useRef({ x: 0, y: 0 });
    const targetGlowRef = useRef({ x: 50, y: 50 });
    const currentGlowRef = useRef({ x: 50, y: 50 });
    const [isActive, setIsActive] = useState(false);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const resetCardVisual = useCallback(() => {
      const card = localRef.current;
      if (!card) return;

      card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      card.style.setProperty('--x', '50%');
      card.style.setProperty('--y', '50%');
      card.style.setProperty('--bg-x', '50%');
      card.style.setProperty('--bg-y', '50%');
    }, []);

    useEffect(() => {
      resetCardVisual();
    }, [resetCardVisual]);

    const stopAnimation = useCallback(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }, []);

    const animateToTarget = useCallback(() => {
      const card = localRef.current;
      if (!card) {
        rafRef.current = null;
        return;
      }

      const damping = 0.14;
      const glowDamping = 0.2;
      currentRotateRef.current.x +=
        (targetRotateRef.current.x - currentRotateRef.current.x) * damping;
      currentRotateRef.current.y +=
        (targetRotateRef.current.y - currentRotateRef.current.y) * damping;
      currentGlowRef.current.x +=
        (targetGlowRef.current.x - currentGlowRef.current.x) * glowDamping;
      currentGlowRef.current.y +=
        (targetGlowRef.current.y - currentGlowRef.current.y) * glowDamping;

      const rotateX = currentRotateRef.current.x;
      const rotateY = currentRotateRef.current.y;

      card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      card.style.setProperty('--x', `${currentGlowRef.current.x}%`);
      card.style.setProperty('--y', `${currentGlowRef.current.y}%`);
      card.style.setProperty('--bg-x', `${currentGlowRef.current.x}%`);
      card.style.setProperty('--bg-y', `${currentGlowRef.current.y}%`);

      const isSettled =
        Math.abs(targetRotateRef.current.x - rotateX) < 0.02 &&
        Math.abs(targetRotateRef.current.y - rotateY) < 0.02 &&
        Math.abs(targetGlowRef.current.x - currentGlowRef.current.x) < 0.05 &&
        Math.abs(targetGlowRef.current.y - currentGlowRef.current.y) < 0.05;

      if (isSettled) {
        rafRef.current = null;
        return;
      }

      rafRef.current = requestAnimationFrame(animateToTarget);
    }, []);

    const startAnimation = useCallback(() => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(animateToTarget);
    }, [animateToTarget]);

    const updateBounds = useCallback(() => {
      if (!localRef.current) return;
      boundsRef.current = localRef.current.getBoundingClientRect();
    }, []);

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = boundsRef.current ?? localRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 18;
      const rotateY = (centerX - x) / 18;

      targetRotateRef.current = { x: rotateX, y: rotateY };
      targetGlowRef.current = {
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
      };
      startAnimation();
    };

    const handleMouseLeave = () => {
      setIsActive(false);
      targetRotateRef.current = { x: 0, y: 0 };
      targetGlowRef.current = { x: 50, y: 50 };
      startAnimation();
    };

    useEffect(() => {
      if (!disabled) return;
      setIsActive(false);
      targetRotateRef.current = { x: 0, y: 0 };
      currentRotateRef.current = { x: 0, y: 0 };
      targetGlowRef.current = { x: 50, y: 50 };
      currentGlowRef.current = { x: 50, y: 50 };
      stopAnimation();
      resetCardVisual();
    }, [disabled, stopAnimation, resetCardVisual]);

    useEffect(() => {
      return () => {
        stopAnimation();
      };
    }, [stopAnimation]);

    return (
      <div
        ref={setRefs}
        onMouseEnter={() => {
          if (disabled) return;
          setIsActive(true);
          updateBounds();
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative h-full w-full rounded-[inherit] will-change-transform [transform-style:preserve-3d] [transform:translateZ(0)]',
          className
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300',
            isActive ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background:
              'radial-gradient(260px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.28), rgba(255,255,255,0.08) 24%, transparent 60%)',
          }}
        />

        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300',
            isActive ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background:
              'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)',
            backgroundPosition: 'var(--bg-x, 50%) var(--bg-y, 50%)',
            mixBlendMode: 'screen',
          }}
        />

        <div className="relative h-full w-full">{children}</div>
      </div>
    );
  }
);

HolographicCard.displayName = 'HolographicCard';

export default HolographicCard;
