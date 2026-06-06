// ===== DOM ELEMENTS =====
const navButtons = document.querySelectorAll('.nav-btn');
const cards = document.querySelectorAll('.card');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const noResults = document.getElementById('noResults');
const statNumbers = document.querySelectorAll('.stat-number');

// ===== STATE =====
let currentCategory = 'all';
let searchTerm = '';

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Animate stats on page load
    animateStats();
    
    // Add event listeners
    setupEventListeners();
    
    // Initial filter
    filterCards();
    
    // Add scroll animations
    setupScrollAnimations();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Category filter buttons
    navButtons.forEach(button => {
        button.addEventListener('click', handleCategoryClick);
    });
    
    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Real-time search
    searchInput.addEventListener('input', debounce(handleRealTimeSearch, 300));
    
    // Card hover effects
    cards.forEach(card => {
        card.addEventListener('mouseenter', handleCardHover);
        card.addEventListener('mouseleave', handleCardLeave);
    });
}

// ===== CATEGORY FILTERING =====
function handleCategoryClick(e) {
    const button = e.currentTarget;
    const category = button.dataset.category;
    
    // Update active button
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Update current category
    currentCategory = category;
    
    // Filter cards
    filterCards();
    
    // Add animation effect
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.style.transform = '';
    }, 150);
}

function filterCards() {
    let visibleCount = 0;
    
    cards.forEach((card, index) => {
        const cardCategory = card.dataset.category;
        const cardText = card.textContent.toLowerCase();
        
        // Check if card matches category and search term
        const matchesCategory = currentCategory === 'all' || cardCategory === currentCategory;
        const matchesSearch = searchTerm === '' || cardText.includes(searchTerm.toLowerCase());
        
        if (matchesCategory && matchesSearch) {
            card.style.display = 'block';
            card.style.animation = 'none';
            setTimeout(() => {
                card.style.animation = `fadeIn 0.5s ease-out ${index * 0.05}s both`;
            }, 10);
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    if (visibleCount === 0) {
        noResults.style.display = 'block';
        noResults.style.animation = 'fadeIn 0.5s ease-out';
    } else {
        noResults.style.display = 'none';
    }
}

// ===== SEARCH FUNCTIONALITY =====
function handleSearch() {
    searchTerm = searchInput.value.trim();
    filterCards();
    
    // Visual feedback
    searchBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        searchBtn.style.transform = '';
    }, 150);
}

function handleRealTimeSearch(e) {
    searchTerm = e.target.value.trim();
    filterCards();
}

// ===== STATS ANIMATION =====
function animateStats() {
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                statNumbers.forEach(stat => {
                    animateCounter(stat);
                });
                observer.disconnect();
            }
        });
    }, observerOptions);
    
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
        observer.observe(statsSection);
    }
}

function animateCounter(element) {
    const target = parseInt(element.dataset.target);
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// ===== CARD INTERACTIONS =====
function handleCardHover(e) {
    const card = e.currentTarget;
    const icon = card.querySelector('.card-icon');
    
    // Add pulse effect to icon
    if (icon) {
        icon.style.animation = 'pulse 0.5s ease-in-out';
    }
}

function handleCardLeave(e) {
    const card = e.currentTarget;
    const icon = card.querySelector('.card-icon');
    
    if (icon) {
        icon.style.animation = '';
    }
}

// ===== SCROLL ANIMATIONS =====
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe cards
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        observer.observe(card);
    });
    
    // Observe fact items
    const factItems = document.querySelectorAll('.fact-item');
    factItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        item.style.transition = `opacity 0.5s ease-out ${index * 0.1}s, transform 0.5s ease-out ${index * 0.1}s`;
        observer.observe(item);
    });
}

// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // Press '/' to focus search
    if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
    }
    
    // Press 'Escape' to clear search
    if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchTerm = '';
        filterCards();
        searchInput.blur();
    }
    
    // Number keys for category selection
    const keyMap = {
        '1': 'all',
        '2': 'retro',
        '3': 'moderna',
        '4': 'easter-eggs',
        '5': 'records'
    };
    
    if (keyMap[e.key]) {
        const button = document.querySelector(`[data-category="${keyMap[e.key]}"]`);
        if (button) {
            button.click();
        }
    }
});

// ===== EASTER EGGS =====
let konamiCode = [];
const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);
    
    if (konamiCode.join(',') === konamiSequence.join(',')) {
        activateKonamiCode();
    }
});

function activateKonamiCode() {
    // Create celebratory effect
    document.body.style.animation = 'rainbow 2s ease-in-out';
    
    // Show secret message
    const message = document.createElement('div');
    message.textContent = '🎮 ¡Código Konami Activado! ¡Eres un verdadero gamer! 🎮';
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #6366f1 0%, #ec4899 100%);
        color: white;
        padding: 2rem 3rem;
        border-radius: 1rem;
        font-size: 1.5rem;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        animation: bounce 0.5s ease-out;
        text-align: center;
    `;
    
    document.body.appendChild(message);
    
    // Add confetti effect
    createConfetti();
    
    setTimeout(() => {
        message.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            message.remove();
            document.body.style.animation = '';
        }, 500);
    }, 3000);
}

function createConfetti() {
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            top: -10px;
            left: ${Math.random() * 100}%;
            opacity: 1;
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
        `;
        
        document.body.appendChild(confetti);
        
        const duration = 2000 + Math.random() * 2000;
        const rotation = Math.random() * 360;
        
        confetti.animate([
            { 
                transform: `translateY(0) rotate(0deg)`,
                opacity: 1
            },
            { 
                transform: `translateY(${window.innerHeight + 20}px) rotate(${rotation}deg)`,
                opacity: 0
            }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        setTimeout(() => {
            confetti.remove();
        }, duration);
    }
}

// ===== RANDOM CURIOSITY FEATURE =====
function showRandomCuriosity() {
    const visibleCards = Array.from(cards).filter(card => card.style.display !== 'none');
    if (visibleCards.length > 0) {
        const randomCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];
        randomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        randomCard.style.animation = 'glow 1s ease-in-out 3';
    }
}

// ===== THEME TOGGLE (Optional Enhancement) =====
let isDarkMode = true;

function toggleTheme() {
    isDarkMode = !isDarkMode;
    // This can be expanded to add a light theme if desired
    console.log('Theme toggle feature ready for expansion');
}

// ===== PERFORMANCE OPTIMIZATION =====
// Lazy load images if added in the future
function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        const lazyImages = document.querySelectorAll('img.lazy');
        lazyImages.forEach(img => imageObserver.observe(img));
    }
}

// ===== ANALYTICS & TRACKING (Placeholder) =====
function trackInteraction(category, action, label) {
    // Placeholder for analytics tracking
    console.log(`Track: ${category} - ${action} - ${label}`);
}

// Add tracking to main interactions
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        trackInteraction('Navigation', 'Category Filter', button.dataset.category);
    });
});

searchBtn.addEventListener('click', () => {
    trackInteraction('Search', 'Search Button', searchInput.value);
});

// ===== EXPORT FOR TESTING =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        filterCards,
        handleSearch,
        animateCounter,
        debounce
    };
}

// ===== CONSOLE EASTER EGG =====
console.log('%c🎮 Gaming Curiosities 🎮', 'color: #6366f1; font-size: 24px; font-weight: bold;');
console.log('%c¿Sabías que...?', 'color: #ec4899; font-size: 16px;');
console.log('%cPuedes usar atajos de teclado:', 'color: #f59e0b; font-size: 14px;');
console.log('%c- Presiona "/" para buscar', 'color: #10b981; font-size: 12px;');
console.log('%c- Presiona 1-5 para cambiar categorías', 'color: #10b981; font-size: 12px;');
console.log('%c- Presiona ESC para limpiar búsqueda', 'color: #10b981; font-size: 12px;');
console.log('%c- Intenta el código Konami... 😉', 'color: #3b82f6; font-size: 12px; font-style: italic;');

// ===== ADDITIONAL ANIMATIONS =====
const style = document.createElement('style');
style.textContent = `
    @keyframes bounce {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
    }
    
    @keyframes glow {
        0%, 100% {
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
        }
        50% {
            box-shadow: 0 0 40px rgba(236, 72, 153, 0.8);
        }
    }
`;
document.head.appendChild(style);

// ===== SMOOTH SCROLL FOR FOOTER LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== INITIALIZATION COMPLETE MESSAGE =====
console.log('%c✓ Página cargada exitosamente', 'color: #10b981; font-size: 14px; font-weight: bold;');
