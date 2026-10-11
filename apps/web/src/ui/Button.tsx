import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'wouter';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'paper' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  children?: ReactNode;
}

const cls = (variant: Variant, size: Size, block?: boolean, extra?: string) =>
  ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block ? 'ui-btn--block' : '', extra ?? ''].filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  children,
  className,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cls(variant, size, block, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
}

/** Router-aware link styled as a button. External links (http...) open in a new tab. */
export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  children,
  className,
  ...rest
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const c = cls(variant, size, block, className);
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </>
  );
  if (/^https?:/.test(href)) {
    return (
      <a href={href} className={c} target="_blank" rel="noreferrer" {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={c} {...rest}>
      {inner}
    </Link>
  );
}
