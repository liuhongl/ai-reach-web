import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';
import React from 'react';

type SiderFooterActionProps = {
  'aria-label'?: string;
  badgeCount?: number;
  badgeVariant?: 'count' | 'dot';
  className?: string;
  collapsed?: boolean;
  disabled?: boolean;
  href?: string;
  icon: ReactNode;
  label: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel'];
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  title?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'className' | 'disabled' | 'onClick' | 'title' | 'type'
> &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'aria-label' | 'className' | 'href' | 'onClick' | 'rel' | 'target' | 'title'
  >;

const joinClassNames = (...values: Array<string | false | undefined>) =>
  values.filter(Boolean).join(' ');

const formatBadgeCount = (count?: number) => {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
};

const SiderFooterAction = React.forwardRef<HTMLElement, SiderFooterActionProps>(
  (
    {
      'aria-label': ariaLabel,
      badgeCount,
      badgeVariant = 'count',
      className,
      collapsed = false,
      disabled,
      href,
      icon,
      label,
      onClick,
      rel,
      target,
      title,
      type = 'button',
      ...restProps
    },
    ref,
  ) => {
    const fallbackLabel = typeof label === 'string' ? label : undefined;
    const badgeText = formatBadgeCount(badgeCount);
    const shouldShowBadge = Boolean(badgeText);
    const content = (
      <>
        <span className="recov-sider-footer-action-icon" aria-hidden="true">
          {icon}
          {shouldShowBadge ? (
            <span
              className={joinClassNames(
                'recov-sider-footer-action-count',
                badgeVariant === 'dot' && 'recov-sider-footer-action-count-dot',
              )}
            >
              {badgeVariant === 'count' ? badgeText : null}
            </span>
          ) : null}
        </span>
        {!collapsed ? (
          <span className="recov-sider-footer-action-label">{label}</span>
        ) : null}
      </>
    );
    const commonProps = {
      'aria-label': ariaLabel || fallbackLabel,
      className: joinClassNames(
        'recov-sider-footer-action',
        collapsed && 'recov-sider-footer-action-collapsed',
        className,
      ),
      onClick,
      title: title || fallbackLabel,
    };

    if (href) {
      return (
        <a
          {...restProps}
          {...commonProps}
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          rel={rel}
          target={target}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        {...restProps}
        {...commonProps}
        disabled={disabled}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
      >
        {content}
      </button>
    );
  },
);

SiderFooterAction.displayName = 'SiderFooterAction';

export default SiderFooterAction;
