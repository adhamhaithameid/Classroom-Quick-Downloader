interface StatsData {
  installs: number;
  countries: number;
  clicksSaved: number;
  hoursSaved: number;
}

interface Config {
  siteUrl: string;
  chromeStoreUrl: string;
  firefoxStoreUrl: string;
  edgeStoreUrl: string;
  version: string;
}

class EmailApp {
  private heroButtons: NodeListOf<HTMLElement>;
  private statsElements: NodeListOf<HTMLElement>;
  private sections: NodeListOf<HTMLElement>;
  private observer: IntersectionObserver | null = null;

  constructor() {
    this.heroButtons = document.querySelectorAll('.btn');
    this.statsElements = document.querySelectorAll('.stat-number');
    this.sections = document.querySelectorAll('.section');
    this.init();
  }

  private init(): void {
    this.initScrollAnimations();
    this.initParallax();
    this.initButtonHover();
    this.initScrollProgress();
    this.initKeyboardNav();
    this.logPageView();
  }

  private initScrollAnimations(): void {
    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          
          if (entry.target.classList.contains('section-stats')) {
            this.animateStats();
          }
          
          this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    this.sections.forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(20px)';
      this.observer?.observe(section);
    });
  }

  private animateStats(): void {
    const targets = [
      { el: this.statsElements[0], target: 1000, suffix: '+' },
      { el: this.statsElements[1], target: 95, suffix: '' },
      { el: this.statsElements[2], target: 251000, suffix: '+' },
      { el: this.statsElements[3], target: 181, suffix: '+' }
    ];

    targets.forEach(({ el, target, suffix }, index) => {
      const duration = 2000;
      const start = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(target * easeOut);
        
        if (target >= 1000) {
          el.textContent = (current / 1000).toFixed(0) + 'K' + suffix;
        } else {
          el.textContent = current.toString() + suffix;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      setTimeout(() => requestAnimationFrame(animate), index * 200);
    });
  }

  private initParallax(): void {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const hero = document.querySelector('.hero') as HTMLElement;
          
          if (hero && scrollY < window.innerHeight) {
            const parallaxValue = scrollY * 0.3;
            hero.style.transform = `translateY(${parallaxValue}px)`;
          }
          
          ticking = false;
        });
        
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  private initButtonHover(): void {
    const buttons = document.querySelectorAll<HTMLAnchorElement>('.btn');
    
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
      });
      
      button.addEventListener('click', (e) => {
        this.trackButtonClick(button.href || '');
      });
    });
  }

  private initScrollProgress(): void {
    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.innerHTML = '<div class="scroll-progress-bar"></div>';
    
    const style = document.createElement('style');
    style.textContent = `
      .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: transparent;
        z-index: 1000;
      }
      .scroll-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #388E3C, #FFC107);
        width: 0%;
        transition: width 0.1s ease;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(progressBar);
    
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      
      const bar = progressBar.querySelector('.scroll-progress-bar') as HTMLElement;
      if (bar) {
        bar.style.width = `${progress}%`;
      }
    };
    
    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  private initKeyboardNav(): void {
    const focusableElements = 'a[href], button, [tabindex]:not([tabindex="-1"])';
    const focusables = document.querySelectorAll<HTMLElement>(focusableElements);
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    });
  }

  private logPageView(): void {
    const data = {
      event: 'page_view',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      referrer: document.referrer
    };
    
    console.log('[Email] Page view tracked:', data);
  }

  private trackButtonClick(url: string): void {
    const data = {
      event: 'button_click',
      url: url,
      timestamp: new Date().toISOString()
    };
    
    console.log('[Email] Button click tracked:', data);
  }

  public animateCountUp(element: HTMLElement, target: number, duration: number = 2000): void {
    const start = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(target * easeOut);
      
      element.textContent = current.toString();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  public getStats(): StatsData {
    return {
      installs: 1000,
      countries: 95,
      clicksSaved: 251000,
      hoursSaved: 181
    };
  }

  public getConfig(): Config {
    return {
      siteUrl: 'https://classroom-quick-downloader.adhamhaithameid.is-a.dev/',
      chromeStoreUrl: 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
      firefoxStoreUrl: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
      edgeStoreUrl: 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
      version: '1.5.5'
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new EmailApp();
});

export { EmailApp };
export type { StatsData, Config };