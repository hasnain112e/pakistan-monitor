import { subscribeAuthState, type AuthSession } from '@/services/auth-state';
import { mountUserButton, openSignIn, openSignUp } from '@/services/clerk';
import { t } from '@/services/i18n';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { isProSubscriber, openProIntelligenceModal } from './ProIntelligenceModal';

export class AuthHeaderWidget {
  private container: HTMLElement;
  private unsubscribeAuth: (() => void) | null = null;
  private unmountUserButton: (() => void) | null = null;
  private onSignInClick?: () => void;
  private onSettingsClick?: () => void;
  private onBillingClick?: () => void;
  private onProStatusChange = () => {
    // Re-render when PRO status changes
    this.render({ isPending: false, user: null, org: null });
  };

  constructor(
    onSignInClick?: () => void,
    onSettingsClick?: () => void,
    onBillingClick?: () => void,
  ) {
    this.onSignInClick = onSignInClick;
    this.onSettingsClick = onSettingsClick;
    this.onBillingClick = onBillingClick;
    this.container = document.createElement('div');
    this.container.className = 'auth-header-widget';

    window.addEventListener('pk-pro-status-changed', this.onProStatusChange);

    this.unsubscribeAuth = subscribeAuthState((state: AuthSession) => {
      if (state.isPending) {
        this.renderPending();
        return;
      }
      this.render(state);
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    window.removeEventListener('pk-pro-status-changed', this.onProStatusChange);
    this.unmountUserButton?.();
    this.unmountUserButton = null;
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }

  private renderProButton(): void {
    const isPro = isProSubscriber();
    const proBtn = document.createElement('button');
    proBtn.type = 'button';
    proBtn.className = isPro ? 'auth-pro-pass-btn auth-pro-active' : 'auth-pro-pass-btn';
    proBtn.innerHTML = isPro
      ? '<span class="pk-pro-pulse"></span>★ PRO ACTIVE'
      : '⚡ PRO INTEL PASS';
    proBtn.title = 'Open Pakistan Monitor PRO Intelligence Suite';
    proBtn.addEventListener('click', () => openProIntelligenceModal());
    this.container.appendChild(proBtn);
  }

  private render(state: AuthSession): void {
    this.unmountUserButton?.();
    this.unmountUserButton = null;
    this.container.classList.remove('auth-header-widget-pending');
    this.container.removeAttribute('aria-busy');
    setTrustedHtml(this.container, trustedHtml('', 'legacy direct innerHTML migration'));

    if (!state.user) {
      this.renderSignedOut();
      return;
    }
    this.renderSignedIn();
  }

  private renderPending(): void {
    this.unmountUserButton?.();
    this.unmountUserButton = null;
    this.container.classList.add('auth-header-widget-pending');
    this.container.setAttribute('aria-busy', 'true');
    setTrustedHtml(this.container, trustedHtml('', 'legacy direct innerHTML migration'));

    const signInSkeleton = document.createElement('span');
    signInSkeleton.className = 'auth-header-skeleton auth-header-skeleton-signin';
    signInSkeleton.setAttribute('aria-hidden', 'true');
    this.container.appendChild(signInSkeleton);

    const signUpSkeleton = document.createElement('span');
    signUpSkeleton.className = 'auth-header-skeleton auth-header-skeleton-signup';
    signUpSkeleton.setAttribute('aria-hidden', 'true');
    this.container.appendChild(signUpSkeleton);
  }

  private renderSignedOut(): void {
    this.renderProButton();

    const signInBtn = document.createElement('button');
    signInBtn.className = 'auth-signin-btn';
    signInBtn.textContent = t('auth.signIn');
    signInBtn.addEventListener('click', () => {
      if (this.onSignInClick) this.onSignInClick();
      else openSignIn();
    });
    this.container.appendChild(signInBtn);

    const signUpLink = document.createElement('button');
    signUpLink.className = 'auth-signup-link';
    signUpLink.textContent = t('auth.createAccount');
    signUpLink.addEventListener('click', () => openSignUp());
    this.container.appendChild(signUpLink);
  }

  private renderSignedIn(): void {
    this.renderProButton();

    const userBtnEl = document.createElement('div');
    userBtnEl.className = 'auth-clerk-user-button';
    this.container.appendChild(userBtnEl);
    this.unmountUserButton = mountUserButton(userBtnEl, {
      onBillingClick: this.onBillingClick,
      onSettingsClick: this.onSettingsClick,
    });
  }
}
